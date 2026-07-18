'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MASKED_TOKEN = '••••••••••••••••';

export function AiSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful and polite customer support assistant.');
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/ai');
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'Token corrupted. Please re-enter your API key.') {
          setErrorStatus(data.error);
        } else {
          toast.error(data.error || 'Failed to load AI configuration');
        }
        return;
      }
      
      setHasApiKey(data.hasApiKey);
      if (data.hasApiKey) {
        setApiKey(MASKED_TOKEN);
      }
      if (data.systemPrompt) {
        setSystemPrompt(data.systemPrompt);
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSave() {
    if (!hasApiKey && (!apiKey.trim() || !keyEdited)) {
      toast.error('OpenAI API Key is required');
      return;
    }
    
    if (!systemPrompt.trim()) {
      toast.error('System prompt is required');
      return;
    }

    try {
      setSaving(true);
      
      const payload: Record<string, string> = {
        system_prompt: systemPrompt.trim(),
      };
      
      if (keyEdited && apiKey !== MASKED_TOKEN && apiKey.trim()) {
        payload.openai_api_key = apiKey.trim();
      } else if (hasApiKey && keyEdited) {
         toast.error('Please re-enter the API Key to save changes');
         setSaving(false);
         return;
      }

      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        return;
      }

      toast.success('AI configuration saved successfully');
      setKeyEdited(false);
      setErrorStatus(null);
      await fetchConfig();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="AI & Knowledge Base"
          description="Configure your OpenAI API key and system prompt for the AI Agent."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title="AI & Knowledge Base"
        description="Configure your OpenAI API key and system prompt for the AI Agent."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {errorStatus && (
            <Alert className="bg-amber-950/40 border-amber-600/40">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <AlertTitle className="text-amber-200 mb-1">
                    API Key Error
                  </AlertTitle>
                  <AlertDescription className="text-amber-100/80 text-sm">
                    {errorStatus}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">OpenAI Integration</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter your OpenAI API key to enable AI features like auto-replies based on your knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">OpenAI API Key</Label>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyEdited(true);
                    }}
                    onFocus={() => {
                      if (apiKey === MASKED_TOKEN) {
                        setApiKey('');
                        setKeyEdited(true);
                      }
                    }}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {hasApiKey && !keyEdited && (
                  <p className="text-xs text-muted-foreground">
                    API Key is hidden for security. Click to re-enter it if you want to update it.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Agent Behavior</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure the core personality and instructions for your AI agent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-muted-foreground">System Prompt</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a helpful customer support agent..."
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  This sets the tone and global instructions for the AI. It will be combined with any documents in your Knowledge Base.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </div>

        {/* Info Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" />
                AI Agent Features
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Adding your OpenAI API key unlocks AI capabilities in your flows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">Knowledge Base RAG</strong>
                  <br />
                  Upload your documents and FAQs. The AI will read them and answer customer questions automatically.
                </p>
                <p>
                  <strong className="text-foreground">Smart Fallbacks</strong>
                  <br />
                  If a user says something outside your flow, the AI can gracefully handle it instead of breaking.
                </p>
                <p>
                  <strong className="text-foreground">Secure Storage</strong>
                  <br />
                  Your API key is securely encrypted at rest. We never store it in plain text.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
