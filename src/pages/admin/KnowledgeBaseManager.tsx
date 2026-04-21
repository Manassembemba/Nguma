import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ragManagementService } from "@/services/ragManagementService";
import { Book, Send, Loader2, Trash2, RefreshCw } from "lucide-react";

export const KnowledgeBaseManager = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .is('parent_id', null) // On ne montre que les documents sources, pas les chunks
      .order('created_at', { ascending: false });

    if (!error) setDocuments(data || []);
    setIsFetching(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous supprimer ce document et tous ses segments vectorisés ?")) return;
    
    // Supprimer les chunks d'abord (cascade gérée ou manuelle)
    await supabase.from('knowledge_base').delete().eq('parent_id', id);
    const { error } = await supabase.from('knowledge_base').delete().eq('id', id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Supprimé", description: "Document retiré de l'IA." });
      fetchDocuments();
    }
  };

  const handleUpload = async () => {
    if (!title || !content) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await ragManagementService.uploadKnowledge(title, content, category);
      toast({ title: "Succès", description: "Document indexé et vectorisé avec succès." });
      setTitle('');
      setContent('');
      fetchDocuments();
    } catch (error: any) {
      toast({ title: "Erreur d'indexation", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Book className="w-8 h-8 text-indigo-600" />
          Intelligence Artificielle & RAG
        </h1>
        <Button variant="outline" onClick={fetchDocuments} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulaire d'ajout */}
        <Card className="shadow-lg border-indigo-100">
          <CardHeader>
            <CardTitle>Nouveau Document de Connaissance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Titre</label>
                <Input 
                  placeholder="Ex: Guide des Dépôts" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Catégorie</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Général</SelectItem>
                    <SelectItem value="finance">Finance & Trading</SelectItem>
                    <SelectItem value="support">Support Technique</SelectItem>
                    <SelectItem value="legal">Légal & CGU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contenu source (Texte brut)</label>
              <Textarea 
                placeholder="Collez ici les informations que l'IA doit apprendre..." 
                className="min-h-[250px] font-mono text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <Button onClick={handleUpload} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {isLoading ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2 w-4 h-4" />}
              Lancer l'Apprentissage IA
            </Button>
          </CardContent>
        </Card>

        {/* Liste des documents */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Documents Indexés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documents.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <p>Aucun document dans la base de connaissances.</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border">
                    <div>
                      <h3 className="font-bold text-sm">{doc.title}</h3>
                      <p className="text-xs text-zinc-500 uppercase">{doc.category} • {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(doc.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
