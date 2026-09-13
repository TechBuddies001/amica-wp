// ============================================================
// /api/account/members
//
// GET: Lists every member of the caller's account.
// POST: Allows Admin/Owner to directly create a team member or
//       a brand-new top-level Workspace Account with an Owner.
// ============================================================

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { canManageMembers, isAccountRole } from "@/lib/auth/roles";
import type { AccountMember } from "@/types";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  account_role: string;
  created_at: string;
}

export async function GET() {
  try {
    const ctx = await getCurrentAccount();

    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("user_id, full_name, email, avatar_url, account_role, created_at")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET /api/account/members] fetch error:", error);
      return NextResponse.json(
        { error: "Failed to load members" },
        { status: 500 },
      );
    }

    const canSeeEmails = canManageMembers(ctx.role);

    const members: AccountMember[] = (data as ProfileRow[]).flatMap((row) => {
      if (!isAccountRole(row.account_role)) return [];
      return [
        {
          user_id: row.user_id,
          full_name: row.full_name ?? "",
          email: canSeeEmails ? row.email : null,
          avatar_url: row.avatar_url,
          role: row.account_role,
          joined_at: row.created_at,
        },
      ];
    });

    return NextResponse.json({ members });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentAccount();

    if (!canManageMembers(ctx.role)) {
      return NextResponse.json(
        { error: "Only admins and owners can create user accounts" },
        { status: 403 }
      );
    }

    const { email, password, fullName, role, createNewWorkspace, workspaceName } = await req.json();

    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { error: "Email, password, fullName, and role are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Create auth user with pre-confirmed email
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create user account" },
        { status: 400 }
      );
    }

    const userId = authUser.user.id;

    // CASE A: Create a Brand New Top-Level Workspace Account with New Owner
    if (createNewWorkspace || role === "owner_new_workspace") {
      const accountName = workspaceName || fullName;
      const { data: newAccount, error: accErr } = await supabaseAdmin
        .from("accounts")
        .insert({
          name: accountName,
          owner_user_id: userId,
          default_currency: "INR",
        })
        .select()
        .single();

      if (accErr || !newAccount) {
        return NextResponse.json(
          { error: "Failed to create new workspace account: " + (accErr?.message || "") },
          { status: 500 }
        );
      }

      await supabaseAdmin.from("profiles").upsert({
        user_id: userId,
        full_name: fullName,
        email: email,
        account_id: newAccount.id,
        account_role: "owner",
        role: "user",
      }, { onConflict: "user_id" });

      return NextResponse.json({
        success: true,
        type: "new_workspace_owner",
        account: newAccount,
        member: {
          user_id: userId,
          full_name: fullName,
          email: email,
          role: "owner",
          joined_at: new Date().toISOString(),
        },
      });
    }

    // CASE B: Add to Current Workspace Account (Owner, Admin, Agent, Viewer)
    if (!isAccountRole(role)) {
      return NextResponse.json(
        { error: "Invalid role specified" },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        user_id: userId,
        full_name: fullName,
        email: email,
        account_id: ctx.accountId,
        account_role: role,
        role: "user",
      }, { onConflict: "user_id" });

    if (profileError) {
      console.error("[POST /api/account/members] profile link error:", profileError);
      return NextResponse.json(
        { error: "Failed to set member role: " + profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      type: "current_workspace_member",
      member: {
        user_id: userId,
        full_name: fullName,
        email: email,
        role: role,
        joined_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
