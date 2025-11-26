import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
    getAllPaymentMethods,
    togglePaymentMethod,
    deletePaymentMethod,
    PaymentMethod
} from '@/services/paymentMethodsService';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Edit, Trash2, Plus } from 'lucide-react';
import * as Icons from 'lucide-react';
import { PaymentMethodForm } from '@/components/admin/PaymentMethodForm';

export const PaymentMethodsManager = () => {
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: methods, isLoading } = useQuery({
        queryKey: ['admin', 'paymentMethods'],
        queryFn: getAllPaymentMethods,
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            togglePaymentMethod(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'paymentMethods'] });
            toast({ title: "✅ Méthode mise à jour" });
        },
        onError: (error: Error) => {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deletePaymentMethod(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'paymentMethods'] });
            toast({ title: "🗑️ Méthode supprimée" });
        },
        onError: (error: Error) => {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message
            });
        }
    });

    const handleToggle = (id: string, isActive: boolean) => {
        toggleMutation.mutate({ id, isActive });
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer "${name}" ?`)) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Grouper par catégorie
    const methodsByCategory = (methods || []).reduce((acc, method) => {
        const categoryName = method.category?.name || 'Autres';
        if (!acc[categoryName]) {
            acc[categoryName] = [];
        }
        acc[categoryName].push(method);
        return acc;
    }, {} as Record<string, PaymentMethod[]>);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Moyens de Paiement</h3>
                    <p className="text-sm text-muted-foreground">
                        Gérez les méthodes de paiement disponibles
                    </p>
                </div>
                <Button onClick={() => { setSelectedMethod(null); setDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle Méthode
                </Button>
            </div>

            {/* Liste par catégorie */}
            {Object.entries(methodsByCategory).map(([categoryName, categoryMethods]) => (
                <Card key={categoryName}>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{categoryName}</CardTitle>
                        <CardDescription>
                            {categoryMethods.length} méthode{categoryMethods.length > 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {categoryMethods.map((method) => {
                            const IconComponent = method.icon
                                ? Icons[method.icon as keyof typeof Icons]
                                : Icons.Circle;

                            return (
                                <div
                                    key={method.id}
                                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                                >
                                    {/* Logo/Icône */}
                                    <div className="flex-shrink-0">
                                        {method.image_url ? (
                                            <img
                                                src={method.image_url}
                                                alt={method.name}
                                                className="h-10 w-10 object-contain rounded"
                                            />
                                        ) : IconComponent ? (
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <IconComponent className="h-5 w-5 text-primary" />
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Informations */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold">{method.name}</h4>
                                            <Badge variant={method.is_active ? "default" : "secondary"}>
                                                {method.is_active ? "Actif" : "Inactif"}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                            <span>Code: {method.code}</span>
                                            {method.available_for_deposit && <span>✅ Dépôt</span>}
                                            {method.available_for_withdrawal && <span>✅ Retrait</span>}
                                            {method.requires_proof && <span>📸 Preuve requise</span>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            checked={method.is_active}
                                            onCheckedChange={(checked) => handleToggle(method.id, checked)}
                                            disabled={toggleMutation.isPending}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => { setSelectedMethod(method); setDialogOpen(true); }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(method.id, method.name)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            ))}

            {/* Dialogue d'édition avec formulaire complet */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedMethod ? `Modifier ${selectedMethod.name}` : "Nouvelle méthode de paiement"}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedMethod
                                ? "Modifiez les informations de cette méthode de paiement"
                                : "Créez une nouvelle méthode de paiement pour votre plateforme"
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <PaymentMethodForm
                        method={selectedMethod}
                        onSave={() => setDialogOpen(false)}
                        onCancel={() => setDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};
