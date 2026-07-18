'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  BookOpen,
  Plus,
  Trash2,
  FileText,
  Loader2,
  MoreVertical,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface KBDocument {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addContent, setAddContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      setLoading(true);
      const res = await fetch('/api/knowledge-base');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocuments(data.documents || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim() || !addContent.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      setIsAdding(true);
      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: addTitle.trim(), content: addContent.trim() }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add document');
      }

      toast.success('Document added to Knowledge Base');
      setIsAddOpen(false);
      setAddTitle('');
      setAddContent('');
      fetchDocuments();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDeleteDocument(id: string) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`/api/knowledge-base/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Document deleted');
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete document');
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="size-6 text-primary" />
            Knowledge Base
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add documents and FAQs for your AI Agent to reference when replying to customers.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="shrink-0 gap-2">
          <Plus className="size-4" />
          Add Document
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <FileText className="size-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No documents yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add your first document to start training your AI Agent. It can be FAQs, product details, or return policies.
            </p>
            <Button onClick={() => setIsAddOpen(true)} className="mt-6 gap-2" variant="outline">
              <Plus className="size-4" />
              Add your first document
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="w-[40%] text-foreground font-medium">Title</TableHead>
                <TableHead className="text-foreground font-medium hidden md:table-cell">Preview</TableHead>
                <TableHead className="text-foreground font-medium w-[150px]">Added</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} className="border-border">
                  <TableCell className="font-medium text-foreground">
                    {doc.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                    {doc.content.substring(0, 80)}...
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="size-8 p-0 hover:bg-muted">
                          <MoreVertical className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleAddDocument}>
            <DialogHeader>
              <DialogTitle>Add Document to Knowledge Base</DialogTitle>
              <DialogDescription>
                Paste your text here. The AI will chunk and vectorize it automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Return Policy 2024"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Paste your document or FAQ here..."
                  className="min-h-[250px]"
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Add Document'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
