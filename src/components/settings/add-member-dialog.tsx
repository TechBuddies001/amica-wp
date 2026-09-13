'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, Loader2, Building2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountRole } from '@/lib/auth/roles';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  onCreated,
}: AddMemberDialogProps) {
  const [accountType, setAccountType] = useState<'current' | 'new_workspace'>('current');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [role, setRole] = useState<AccountRole | 'owner_new_workspace'>('agent');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const isNewWorkspace = accountType === 'new_workspace';
      const res = await fetch('/api/account/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          password,
          role: isNewWorkspace ? 'owner_new_workspace' : role,
          createNewWorkspace: isNewWorkspace,
          workspaceName: isNewWorkspace ? (workspaceName || fullName) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (isNewWorkspace) {
          toast.success(`🎉 New Top-Level Workspace "${data.account?.name || workspaceName || fullName}" Created with Owner ${fullName}!`);
        } else {
          toast.success(`Account created for ${fullName}!`);
        }
        setFullName('');
        setEmail('');
        setPassword('');
        setWorkspaceName('');
        setRole('agent');
        setAccountType('current');
        onOpenChange(false);
        onCreated();
      } else {
        toast.error(data.error || 'Failed to create account');
      }
    } catch (err: any) {
      toast.error('Error creating account: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="size-5 text-primary" />
            Create User / Workspace Account
          </DialogTitle>
          <DialogDescription>
            Admin Control Panel for adding team members or provisioning new top-level Workspace Accounts with Owners.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Account Creation Mode Toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Account Scope
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={accountType === 'current' ? 'default' : 'outline'}
                onClick={() => {
                  setAccountType('current');
                  setRole('agent');
                }}
                className="justify-start gap-2 h-11 text-xs"
              >
                <ShieldCheck className="size-4" />
                Add Teammate to Current Workspace
              </Button>
              <Button
                type="button"
                variant={accountType === 'new_workspace' ? 'default' : 'outline'}
                onClick={() => {
                  setAccountType('new_workspace');
                  setRole('owner_new_workspace');
                }}
                className="justify-start gap-2 h-11 text-xs"
              >
                <Building2 className="size-4 text-amber-400" />
                Create New Workspace (New Owner)
              </Button>
            </div>
          </div>

          {accountType === 'new_workspace' && (
            <div className="space-y-1.5 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
              <Label htmlFor="add-ws-name" className="text-xs font-semibold text-amber-300">
                New Workspace / Business Name
              </Label>
              <Input
                id="add-ws-name"
                placeholder="e.g. Doon Divine Properties"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
                className="bg-background/80"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Creates a new independent top-level CRM Workspace with this user as the <strong>Owner</strong>.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="add-name">Full Name</Label>
            <Input
              id="add-name"
              placeholder="e.g. Vikas"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-email">Email Address</Label>
            <Input
              id="add-email"
              type="email"
              placeholder="e.g. vikas@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-password">Password</Label>
            <Input
              id="add-password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {accountType === 'current' && (
            <div className="space-y-1.5">
              <Label htmlFor="add-role">Role in Current Workspace</Label>
              <Select value={role} onValueChange={(val) => setRole(val as AccountRole)}>
                <SelectTrigger id="add-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner (Full Workspace Control)</SelectItem>
                  <SelectItem value="admin">Admin (Manage members + settings)</SelectItem>
                  <SelectItem value="agent">Agent (Inbox, Broadcasts, CRM)</SelectItem>
                  <SelectItem value="viewer">Viewer (Read-only access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : accountType === 'new_workspace' ? (
                <Building2 className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {accountType === 'new_workspace' ? 'Create Workspace & Owner' : 'Create User Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
