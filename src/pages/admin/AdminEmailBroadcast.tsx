import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Users, Send, Search, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const AdminEmailBroadcast = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [activeContractUserIds, setActiveContractUserIds] = useState<Set<string>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch users with emails
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .not('email', 'is', null)
        .order('first_name', { ascending: true });

      if (userError) throw userError;

      // 2. Fetch IDs of users with active contracts
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select('user_id')
        .eq('status', 'active');

      if (contractError) throw contractError;

      const activeIds = new Set(contractData.map(c => c.user_id));
      
      setUsers(userData || []);
      setActiveContractUserIds(activeIds);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesActiveFilter = !onlyActive || activeContractUserIds.has(u.id);
    
    return matchesSearch && matchesActiveFilter;
  });

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const toggleAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    }
  };

  const handleSend = async () => {
    if (!subject || !message) {
      toast({ title: "Erreur", description: "Veuillez remplir le sujet et le message", variant: "destructive" });
      return;
    }

    if (selectedUserIds.length === 0) {
      toast({ title: "Erreur", description: "Veuillez sélectionner au moins un destinataire", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const isAllSelected = selectedUserIds.length === users.length;
      
      const { data, error } = await supabase.rpc('send_admin_broadcast', {
        p_user_ids: isAllSelected ? null : selectedUserIds,
        p_subject: subject,
        p_message: message
      });

      if (error) throw error;

      toast({ 
        title: "Succès", 
        description: `${data.count} emails ont été mis en file d'attente pour envoi.` 
      });
      
      // Reset form immediately to prevent resubmission
      setSubject('');
      setMessage('');
      setSelectedUserIds([]);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Mail className="w-8 h-8 text-primary" />
        Diffusion d'Emails aux Utilisateurs
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne Sélection Utilisateurs */}
        <Card className="lg:col-span-1 shadow-lg h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex justify-between items-center">
              Destinataires ({selectedUserIds.length})
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selectedUserIds.length === filteredUsers.length ? 'Tout dégroupé' : 'Tout cocher'}
              </Button>
            </CardTitle>
            
            <div className="flex items-center space-x-2 mt-4 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg border">
              <Checkbox 
                id="only-active" 
                checked={onlyActive} 
                onCheckedChange={(checked) => setOnlyActive(!!checked)} 
              />
              <label htmlFor="only-active" className="text-sm font-medium leading-none cursor-pointer">
                Uniquement contrats actifs
              </label>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input 
                placeholder="Rechercher un utilisateur..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className={`flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors ${selectedUserIds.includes(user.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                      onClick={() => toggleUser(user.id)}
                    >
                      <Checkbox checked={selectedUserIds.includes(user.id)} onCheckedChange={() => toggleUser(user.id)} />
                      <div className="overflow-hidden flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{user.first_name} {user.last_name}</p>
                          {activeContractUserIds.has(user.id) && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 h-5 px-1.5 text-[10px]">
                              Actif
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-center py-8 text-zinc-500 text-sm italic">
                      Aucun utilisateur correspondant
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonne Composition Message */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Composer le Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sujet de l'email</label>
              <Input 
                placeholder="Ex: Mise à jour importante du système" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea 
                placeholder="Écrivez votre message ici... (Le nom de l'utilisateur sera automatiquement inséré au début)" 
                className="min-h-[300px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-xs text-zinc-400">
                Note: Les emails sont envoyés via une file d'attente pour éviter d'être marqués comme spam.
              </p>
            </div>
            <Button 
              className="w-full h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700" 
              onClick={handleSend} 
              disabled={isSending || selectedUserIds.length === 0}
            >
              {isSending ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2 w-5 h-5" />}
              Envoyer à {selectedUserIds.length} utilisateur(s)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
