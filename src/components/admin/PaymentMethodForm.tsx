import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    PaymentMethod,
    PaymentMethodField,
    createPaymentMethod,
    updatePaymentMethod,
    getAllCategories,
} from '@/services/paymentMethodsService';
import { uploadPaymentMethodLogo, updatePaymentMethodImage } from '@/services/paymentMethodImageService';
import { Loader2, X } from 'lucide-react';
import * as Icons from 'lucide-react';
import { PaymentMethodFieldsEditor } from '@/components/admin/PaymentMethodFieldsEditor';

interface Props {
    method: PaymentMethod | null;
    onSave: () => void;
    onCancel: () => void;
}

export const PaymentMethodForm = ({ method, onSave, onCancel }: Props) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const isEditing = !!method;

    // Form state
    const [formData, setFormData] = useState({
        name: method?.name || '',
        code: method?.code || '',
        type: method?.type || 'mobile_money',
        category_id: method?.category_id || '',
        icon: method?.icon || 'Circle',
        description: method?.description || '',
        is_active: method?.is_active ?? true,
        available_for_deposit: method?.available_for_deposit ?? true,
        available_for_withdrawal: method?.available_for_withdrawal ?? false,
        min_amount: method?.min_amount || 0,
        max_amount: method?.max_amount || 0,
        fee_type: method?.fee_type || 'none',
        fee_fixed: method?.fee_fixed || 0,
        fee_percentage: method?.fee_percentage || 0,
        instructions: method?.instructions || '',
        admin_instructions: method?.admin_instructions || '',
        requires_proof: method?.requires_proof ?? true,
        processing_time: method?.processing_time || '',
    });

    const [fields] = useState<Partial<PaymentMethodField>[]>(
        method?.fields || []
    );
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(method?.image_url || null);
    const [isUploading, setIsUploading] = useState(false);

    const { data: categories } = useQuery({
        queryKey: ['admin', 'paymentCategories'],
        queryFn: getAllCategories,
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            let methodId = method?.id;

            // 1. Créer ou mettre à jour la méthode
            if (isEditing) {
                await updatePaymentMethod(method.id, formData);
            } else {
                const newMethod = await createPaymentMethod(formData);
                methodId = newMethod.id;
            }

            // 2. Upload du logo si présent
            if (logoFile && methodId) {
                setIsUploading(true);
                const imageUrl = await uploadPaymentMethodLogo(logoFile, formData.code);
                await updatePaymentMethodImage(methodId, imageUrl);
                setIsUploading(false);
            }

            return methodId;
        },
        onSuccess: () => {
            toast({ title: `✅ Méthode ${isEditing ? 'modifiée' : 'créée'} avec succès` });
            queryClient.invalidateQueries({ queryKey: ['admin', 'paymentMethods'] });
            onSave();
        },
        onError: (error: Error) => {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message
            });
        }
    });

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validation
            if (!file.type.startsWith('image/')) {
                toast({
                    variant: "destructive",
                    title: "Erreur",
                    description: "Veuillez sélectionner une image"
                });
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                toast({
                    variant: "destructive",
                    title: "Erreur",
                    description: "L'image ne doit pas dépasser 2MB"
                });
                return;
            }

            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const iconOptions = [
        'Circle', 'Smartphone', 'Bitcoin', 'Wallet', 'CreditCard',
        'DollarSign', 'Banknote', 'Globe', 'Building', 'Send'
    ];

    return (
        <div className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Informations</TabsTrigger>
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                    <TabsTrigger value="fields">Champs</TabsTrigger>
                </TabsList>

                {/* Onglet 1: Informations de base */}
                <TabsContent value="basic" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informations de Base</CardTitle>
                            <CardDescription>Nom, code et description de la méthode</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nom *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ex: M-Pesa"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="code">Code *</Label>
                                    <Input
                                        id="code"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                                        placeholder="Ex: mpesa_rdc"
                                        required
                                        disabled={isEditing}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Identifiant unique (ne peut pas être modifié)
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Type *</Label>
                                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                            <SelectItem value="crypto">Cryptomonnaie</SelectItem>
                                            <SelectItem value="bank_transfer">Virement Bancaire</SelectItem>
                                            <SelectItem value="international_transfer">Transfert International</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="category">Catégorie</Label>
                                    <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sélectionner..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories?.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="icon">Icône</Label>
                                    <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {iconOptions.map(icon => {
                                                const IconComponent = Icons[icon as keyof typeof Icons];
                                                return (
                                                    <SelectItem key={icon} value={icon}>
                                                        <div className="flex items-center gap-2">
                                                            {IconComponent && <IconComponent className="h-4 w-4" />}
                                                            {icon}
                                                        </div>
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="processing_time">Temps de traitement</Label>
                                    <Input
                                        id="processing_time"
                                        value={formData.processing_time}
                                        onChange={(e) => setFormData({ ...formData, processing_time: e.target.value })}
                                        placeholder="Ex: Instantané, 24h, 2-3 jours"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Description courte de la méthode"
                                    rows={2}
                                />
                            </div>

                            {/* Logo Upload */}
                            <div className="space-y-2">
                                <Label>Logo (Optionnel)</Label>
                                <div className="flex items-center gap-4">
                                    {logoPreview && (
                                        <div className="relative">
                                            <img src={logoPreview} alt="Logo" className="h-16 w-16 object-contain rounded border" />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute -top-2 -right-2 h-6 w-6"
                                                onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoChange}
                                            className="cursor-pointer"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            JPG, PNG, SVG - Max 2MB
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Onglet 2: Configuration */}
                <TabsContent value="config" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Disponibilité</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="available_deposit">Disponible pour dépôt</Label>
                                    <p className="text-sm text-muted-foreground">Les utilisateurs peuvent déposer avec cette méthode</p>
                                </div>
                                <Switch
                                    id="available_deposit"
                                    checked={formData.available_for_deposit}
                                    onCheckedChange={(checked) => setFormData({ ...formData, available_for_deposit: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="available_withdrawal">Disponible pour retrait</Label>
                                    <p className="text-sm text-muted-foreground">Les utilisateurs peuvent retirer avec cette méthode</p>
                                </div>
                                <Switch
                                    id="available_withdrawal"
                                    checked={formData.available_for_withdrawal}
                                    onCheckedChange={(checked) => setFormData({ ...formData, available_for_withdrawal: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="requires_proof">Preuve requise</Label>
                                    <p className="text-sm text-muted-foreground">L'utilisateur doit fournir une preuve de paiement</p>
                                </div>
                                <Switch
                                    id="requires_proof"
                                    checked={formData.requires_proof}
                                    onCheckedChange={(checked) => setFormData({ ...formData, requires_proof: checked })}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="is_active">Actif</Label>
                                    <p className="text-sm text-muted-foreground">La méthode est visible et utilisable</p>
                                </div>
                                <Switch
                                    id="is_active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Limites & Frais</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="min_amount">Montant minimum (USD)</Label>
                                    <Input
                                        id="min_amount"
                                        type="number"
                                        value={formData.min_amount}
                                        onChange={(e) => setFormData({ ...formData, min_amount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="max_amount">Montant maximum (USD)</Label>
                                    <Input
                                        id="max_amount"
                                        type="number"
                                        value={formData.max_amount}
                                        onChange={(e) => setFormData({ ...formData, max_amount: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="fee_type">Type de frais</Label>
                                <Select value={formData.fee_type} onValueChange={(value: any) => setFormData({ ...formData, fee_type: value })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Aucun</SelectItem>
                                        <SelectItem value="fixed">Fixe</SelectItem>
                                        <SelectItem value="percentage">Pourcentage</SelectItem>
                                        <SelectItem value="combined">Fixe + Pourcentage</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {(formData.fee_type === 'fixed' || formData.fee_type === 'combined') && (
                                <div className="space-y-2">
                                    <Label htmlFor="fee_fixed">Frais fixes (USD)</Label>
                                    <Input
                                        id="fee_fixed"
                                        type="number"
                                        step="0.01"
                                        value={formData.fee_fixed}
                                        onChange={(e) => setFormData({ ...formData, fee_fixed: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            )}

                            {(formData.fee_type === 'percentage' || formData.fee_type === 'combined') && (
                                <div className="space-y-2">
                                    <Label htmlFor="fee_percentage">Frais en pourcentage (%)</Label>
                                    <Input
                                        id="fee_percentage"
                                        type="number"
                                        step="0.1"
                                        value={formData.fee_percentage}
                                        onChange={(e) => setFormData({ ...formData, fee_percentage: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Instructions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="instructions">Instructions pour l'utilisateur</Label>
                                <Textarea
                                    id="instructions"
                                    value={formData.instructions}
                                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                                    placeholder="Instructions affichées à l'utilisateur lors du paiement"
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="admin_instructions">Instructions pour l'admin</Label>
                                <Textarea
                                    id="admin_instructions"
                                    value={formData.admin_instructions}
                                    onChange={(e) => setFormData({ ...formData, admin_instructions: e.target.value })}
                                    placeholder="Instructions pour vérifier les paiements (visible uniquement par les admins)"
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Onglet 3: Champs personnalisés */}
                <TabsContent value="fields" className="space-y-4">
                    {method ? (
                        <PaymentMethodFieldsEditor
                            methodId={method.id}
                            fields={fields as PaymentMethodField[]}
                        />
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Champs Personnalisés</CardTitle>
                                <CardDescription>
                                    Sauvegardez d'abord la méthode pour pouvoir ajouter des champs
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>Créez la méthode puis revenez ici pour ajouter les champs</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancel} disabled={saveMutation.isPending || isUploading}>
                    Annuler
                </Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isUploading}>
                    {saveMutation.isPending || isUploading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {isUploading ? "Upload en cours..." : "Sauvegarde..."}
                        </>
                    ) : (
                        <>💾 {isEditing ? 'Sauvegarder' : 'Créer'}</>
                    )}
                </Button>
            </div>
        </div>
    );
};
