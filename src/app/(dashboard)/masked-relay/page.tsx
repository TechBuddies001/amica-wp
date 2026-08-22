'use client'

import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Phone,
  User,
  Clock,
  ArrowRightLeft,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface MaskedSession {
  id: string
  accountId: string
  agentPhone: string
  agentName: string
  customerPhone: string
  customerName: string
  templateName?: string
  status: 'active' | 'closed' | 'expired'
  expiresAt: string
  createdAt: string
  lastActivityAt: string
}

export default function MaskedRelayPage() {
  const [sessions, setSessions] = useState<MaskedSession[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [openModal, setOpenModal] = useState(false)

  // Form fields
  const [agentPhone, setAgentPhone] = useState('')
  const [agentName, setAgentName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [templateName, setTemplateName] = useState('property_sale_doon_divine')
  const [submitting, setSubmitting] = useState(false)

  const loadSessions = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/whatsapp/masked-relay')
      const data = await res.json()
      if (res.ok && data.sessions) {
        setSessions(data.sessions)
      } else {
        toast.error(data.error || 'Failed to load masked sessions')
      }
    } catch (err: any) {
      toast.error('Failed to load masked sessions: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agentPhone || !customerPhone) {
      toast.error('Please enter both Agent and Customer phone numbers')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/whatsapp/masked-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentPhone,
          agentName: agentName || undefined,
          customerPhone,
          customerName: customerName || undefined,
          templateName: templateName || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('🔒 Masked Proxy Relay Session Started!')
        setOpenModal(false)
        setAgentPhone('')
        setAgentName('')
        setCustomerPhone('')
        setCustomerName('')
        loadSessions()
      } else {
        toast.error(data.error || 'Failed to start session')
      }
    } catch (err: any) {
      toast.error('Error starting session: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseSession = async (contactId: string) => {
    try {
      const res = await fetch('/api/whatsapp/masked-relay', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, action: 'close' }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Session closed successfully')
        loadSessions()
      } else {
        toast.error(data.error || 'Failed to close session')
      }
    } catch (err: any) {
      toast.error('Error closing session: ' + err.message)
    }
  }

  const filteredSessions = sessions.filter(
    (s) =>
      s.agentPhone.includes(searchQuery) ||
      s.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.customerPhone.includes(searchQuery) ||
      s.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = sessions.filter((s) => s.status === 'active').length
  const totalCount = sessions.length

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              WhatsApp Masked Relay
            </h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Exotel-style Number Proxy
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Connect Field Agents (Side A) to Customers (Side B) with 2-way WhatsApp number privacy. Neither party sees the other&apos;s real phone number.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadSessions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button onClick={() => setOpenModal(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" />
            New Masked Session
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/60 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Relay Sessions</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently forwarding 2-way chats</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Relays Created</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Total proxy connections managed</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Number Privacy</CardTitle>
            <ShieldCheck className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">100% Protected</div>
            <p className="text-xs text-muted-foreground mt-1">All messages delivered from Business WABA</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold">Active &amp; Past Proxy Sessions</CardTitle>
              <CardDescription>
                Live monitoring of 2-way masked conversations between agents and clients.
              </CardDescription>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50 border-border/60"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              Loading masked relay sessions...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-12 text-center border-t border-border/40">
              <div className="inline-flex p-4 rounded-full bg-muted/30 text-muted-foreground mb-3">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No Masked Relay Sessions Found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Click &quot;New Masked Session&quot; to connect a field agent with a customer, or agents can text <strong>CONNECT &lt;phone&gt;</strong> on WhatsApp.
              </p>
              <Button onClick={() => setOpenModal(true)} className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Start First Session
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border/40">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-muted/40 text-muted-foreground border-b border-border/40">
                  <tr>
                    <th className="px-6 py-3 font-medium">Field Agent (Side A)</th>
                    <th className="px-6 py-3 font-medium text-center">Proxy Relay</th>
                    <th className="px-6 py-3 font-medium">Customer (Side B)</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Expires At</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      {/* Agent */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{s.agentName}</div>
                            <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> +{s.agentPhone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Central Proxy Badge */}
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-2 py-0.5">
                            <ArrowRightLeft className="w-3 h-3 mr-1" /> Business WABA
                          </Badge>
                          <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">2-Way Masked</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{s.customerName}</div>
                            <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> +{s.customerPhone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {s.status === 'active' ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </Badge>
                        ) : s.status === 'expired' ? (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="w-3 h-3" /> Expired
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground gap-1">
                            <XCircle className="w-3 h-3" /> Closed
                          </Badge>
                        )}
                      </td>

                      {/* Expiration */}
                      <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {new Date(s.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {s.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCloseSession(s.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4 mr-1" /> End Session
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Session Modal */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-[500px] border-border/60 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Start New Masked Proxy Session
            </DialogTitle>
            <DialogDescription>
              Connect a Field Agent with a Customer. Both will communicate through your Business WhatsApp Number with full 2-way number privacy.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStartSession} className="space-y-4 py-2">
            {/* Agent Info */}
            <div className="space-y-2 border-l-2 border-blue-500/50 pl-3 py-1">
              <Label className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Field Agent (Side A)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    placeholder="Agent Phone (91987...)"
                    value={agentPhone}
                    onChange={(e) => setAgentPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    placeholder="Agent Name (e.g. Akash)"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-2 border-l-2 border-emerald-500/50 pl-3 py-1">
              <Label className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Customer (Side B)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    placeholder="Customer Phone (91987...)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Input
                    placeholder="Customer Name (e.g. Deepak)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Template Choice */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Approved Greeting Template
              </Label>
              <Input
                placeholder="Template Name (default: property_sale_doon_divine)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Meta requires sending an approved template message to start 2-way customer conversation.
              </p>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Initiate Masked Proxy Session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
