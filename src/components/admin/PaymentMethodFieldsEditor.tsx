import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
    PaymentMethodField,
    addPaymentMethodField,
    updatePaymentMethodField,
    deletePaymentMethodField
} from '@/services/paymentMethodsService';
import { Plus, Trash2, GripVertical, Copy, Eye } from 'lucide-react';

interface Props {
    methodId: string;
    fields: PaymentMethodField[];
}

export const PaymentMethodFieldsEditor = ({ methodId, fields }: Props) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editingField, setEditingField] = useState<PaymentMethodField | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    // État du formulaire
    const [formData, setFormData] = useState({
        field_key: '',
        field_label: '',
        field_type: 'text' as 'text' | 'textarea' | 'number' | 'tel' | 'email' | 'file',
        field_placeholder: '',
        is_required: false,
        is_user_input: false,
        field_value: '',
        validation_regex: '',
        validation_message: '',
        help_text: '',
        show_copy_button: false,
    });

    const resetForm = () => {
        setFormData({
            field_key: '',
            field_label: '',
            field_type: 'text',
            field_placeholder: '',
            is_required: false,
            is_user_input: false,
            field_value: '',
            validation_regex: '',
            validation_message: '',
            help_text: '',
            show_copy_button: false,
        });
        setEditingField(null);
        setIsAdding(false);
    };

    const addMutation = useMutation({
        mutationFn: async () => {
            const maxOrder = Math.max(...fields.map(f => f.display_order), 0);
            return addPaymentMethodField({
                payment_method_id: methodId,
                ...formData,
                display_order: maxOrder + 1,
            });
        },
        onSuccess: () => {
            toast({ title: "✅ Champ ajouté" });
            queryClient.invalidateQueries({ queryKey: ['admin', 'paymentMethods'] });
            resetForm();
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Erreur", description: error.message });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editingField) return;
            return updatePaymentMethodField(editingField.id, formData);
        },
        onSuccess: () => {
            toast({ title: "✅ Champ modifié" });
            queryClient.invalidateQueries({ queryKey: ['admin', 'paymentMethods'] });
            resetForm();
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Erreur", description: error.message });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (fieldId: string) => deletePaymentMethodField(fieldId),
        onSuccess: () => {
            toast({ title: "🗑️ Champ supprimé" });
            queryClient.invalidateQueries({ queryKey: ['admin', 'paymentMethods'] });
        },
        onError: (error: Error) => {
            toast({ variant: "destructive", title: "Erreur", description: error.message });
        }
    });

    const handleEdit = (field: PaymentMethodField) => {
        setEditingField(field);
        setFormData({
            field_key: field.field_key,
            field_label: field.field_label,
            field_type: field.field_type,
            field_placeholder: field.field_placeholder || '',
            is_required: field.is_required,
            is_user_input: field.is_user_input,
            field_value: field.field_value || '',
            validation_regex: field.validation_regex || '',
            validation_message: field.validation_message || '',
            help_text: field.help_text || '',
            show_copy_button: field.show_copy_button,
        });
        setIsAdding(true);
    };

    const handleDelete = (fieldId: string, fieldLabel: string) => {
        if (confirm(`Supprimer le champ "${fieldLabel}" ?`)) {
            deleteMutation.mutate(fieldId);
        }
    };

    const handleSave = () => {
        if (editingField) {
            updateMutation.mutate();
        } else {
            addMutation.mutate();
        }
    };

    // Séparer les champs admin et utilisateur
    const adminFields = fields.filter(f => !f.is_user_input);
    const userFields = fields.filter(f => f.is_user_input);

    return (
        <div className="space-y-6">
            {/* Liste des champs existants */}
            <div className="space-y-4">
                {/* Champs Admin (Affichage) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Informations de Paiement (Affichage)
                        </CardTitle>
                        <CardDescription>
                            Ces informations seront affichées à l'utilisateur (numéros, adresses, etc.)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {adminFields.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Aucun champ d'affichage. Ajoutez le numéro, l'adresse ou les infos bancaires.
                            </p>
                        ) : (
                            adminFields.map((field) => (
                                <div key={field.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{field.field_label}</span>
                                            {field.show_copy_button && <Copy className="h-3 w-3 text-muted-foreground" />}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {field.field_value || <span className="italic">Aucune valeur</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(field)}>
                                            Modifier
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(field.id, field.field_label)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Champs Utilisateur (Saisie) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            ✍️ Champs de Saisie Utilisateur
                        </CardTitle>
                        <CardDescription>
                            Ces champs seront remplis par l'utilisateur lors du paiement
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {userFields.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Aucun champ de saisie. Ajoutez les champs que l'utilisateur doit remplir.
                            </p>
                        ) : (
                            userFields.map((field) => (
                                <div key={field.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{field.field_label}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {field.field_type}
                                            </Badge>
                                            {field.is_required && <Badge variant="secondary" className="text-xs">Requis</Badge>}
                                        </div>
                                        {field.help_text && (
                                            <div className="text-sm text-muted-foreground">{field.help_text}</div>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(field)}>
                                            Modifier
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(field.id, field.field_label)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Bouton Ajouter */}
            {!isAdding && (
                <Button onClick={() => setIsAdding(true)} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un Champ
                </Button>
            )}

            {/* Formulaire d'ajout/édition */}
            {isAdding && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            {editingField ? 'Modifier le Champ' : 'Nouveau Champ'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Type de champ */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                            <div>
                                <Label>Type de champ</Label>
                                <p className="text-sm text-muted-foreground">
                                    {formData.is_user_input
                                        ? "L'utilisateur remplira ce champ"
                                        : "Information affichée à l'utilisateur"}
                                </p>
                            </div>
                            <Switch
                                checked={formData.is_user_input}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_user_input: checked })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Libellé *</Label>
                                <Input
                                    value={formData.field_label}
                                    onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                                    placeholder="Ex: Numéro M-Pesa"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Clé technique *</Label>
                                <Input
                                    value={formData.field_key}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        field_key: e.target.value.toLowerCase().replace(/\s/g, '_')
                                    })}
                                    placeholder="Ex: mpesa_number"
                                    disabled={!!editingField}
                                />
                            </div>
                        </div>

                        {!formData.is_user_input ? (
                            // Champ Admin (Affichage)
                            <>
                                <div className="space-y-2">
                                    <Label>Valeur à afficher *</Label>
                                    <Input
                                        value={formData.field_value}
                                        onChange={(e) => setFormData({ ...formData, field_value: e.target.value })}
                                        placeholder="Ex: +243817432265 ou adresse crypto"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Cette valeur sera affichée à l'utilisateur
                                    </p>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Bouton "Copier"</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Ajouter un bouton pour copier la valeur
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.show_copy_button}
                                        onCheckedChange={(checked) => setFormData({ ...formData, show_copy_button: checked })}
                                    />
                                </div>
                            </>
                        ) : (
                            // Champ Utilisateur (Saisie)
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Type de saisie</Label>
                                        <Select
                                            value={formData.field_type}
                                            onValueChange={(value: any) => setFormData({ ...formData, field_type: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text">Texte</SelectItem>
                                                <SelectItem value="textarea">Texte long</SelectItem>
                                                <SelectItem value="number">Nombre</SelectItem>
                                                <SelectItem value="tel">Téléphone</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                                <SelectItem value="file">Fichier</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Placeholder</Label>
                                        <Input
                                            value={formData.field_placeholder}
                                            onChange={(e) => setFormData({ ...formData, field_placeholder: e.target.value })}
                                            placeholder="Ex: Entrez votre numéro"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Texte d'aide</Label>
                                    <Textarea
                                        value={formData.help_text}
                                        onChange={(e) => setFormData({ ...formData, help_text: e.target.value })}
                                        placeholder="Instructions pour l'utilisateur"
                                        rows={2}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Champ requis</Label>
                                        <p className="text-sm text-muted-foreground">
                                            L'utilisateur doit obligatoirement remplir ce champ
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.is_required}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Regex de validation</Label>
                                        <Input
                                            value={formData.validation_regex}
                                            onChange={(e) => setFormData({ ...formData, validation_regex: e.target.value })}
                                            placeholder="Ex: ^\d{10}$"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Message d'erreur</Label>
                                        <Input
                                            value={formData.validation_message}
                                            onChange={(e) => setFormData({ ...formData, validation_message: e.target.value })}
                                            placeholder="Ex: Numéro invalide"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={resetForm}>
                                Annuler
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={!formData.field_label || !formData.field_key || addMutation.isPending || updateMutation.isPending}
                            >
                                {editingField ? '💾 Modifier' : '➕ Ajouter'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
