
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSetting } from "@/services/settingsService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";

type Setting = {
  key: string;
  value: string;
};

export const AdminSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsState, setSettingsState] = useState<Setting[]>([]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (settings) {
      setSettingsState(settings);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateSetting,
    onSuccess: () => {
      toast({ title: "Succès", description: "Paramètre mis à jour." });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const handleInputChange = (key: string, value: string) => {
    setSettingsState(currentSettings => 
      currentSettings.map(s => s.key === key ? { ...s, value } : s)
    );
  };

  const handleSave = (key: string) => {
    const settingToSave = settingsState.find(s => s.key === key);
    if (settingToSave) {
      mutation.mutate(settingToSave);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Paramètres Globaux</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres Globaux</CardTitle>
        <CardDescription>Modifiez les paramètres de l'application. Ces changements sont appliqués en temps réel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {settingsState.map((setting) => (
          <div key={setting.key} className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor={setting.key} className="capitalize font-medium">{setting.key.replace(/_/g, ' ')}</Label>
              <p className="text-sm text-muted-foreground">{settings?.find(s => s.key === setting.key)?.description}</p>
            </div>
            <div className="flex items-center gap-2 w-1/3">
              <Input
                id={setting.key}
                value={setting.value}
                onChange={(e) => handleInputChange(setting.key, e.target.value)}
              />
              <Button onClick={() => handleSave(setting.key)} disabled={mutation.isPending && mutation.variables?.key === setting.key}>
                Sauvegarder
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
