import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PaymentMethod, PaymentMethodField } from '@/services/paymentMethodsService';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Props {
    method: PaymentMethod;
    amount: number;
    onSubmit: (formData: Record<string, any>) => void;
    isSubmitting?: boolean;
}

export const DynamicPaymentForm = ({ method, amount, onSubmit, isSubmitting = false }: Props) => {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
    const [isUploading, setIsUploading] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const { toast } = useToast();

    const adminFields = method.fields?.filter(f => !f.is_user_input) || [];
    const userFields = method.fields?.filter(f => f.is_user_input) || [];

    const copyToClipboard = (text: string, fieldKey: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldKey);
        toast({ description: "✅ Copié dans le presse-papier" });
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleFileUpload = async (fieldKey: string, file: File) => {
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('payment_proofs')
                .upload(fileName, file);

            if (uploadError) {
                toast({
                    variant: "destructive",
                    title: "Erreur d'upload",
                    description: uploadError.message
                });
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('payment_proofs')
                .getPublicUrl(fileName);

            setUploadedFiles(prev => ({ ...prev, [fieldKey]: publicUrl }));
            setFormData(prev => ({ ...prev, [fieldKey]: publicUrl }));

            toast({
                title: "✅ Fichier uploadé",
                description: "Votre preuve de paiement a été téléchargée avec succès."
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation des champs requis
        const missingFields = userFields
            .filter(f => f.is_required && !formData[f.field_key])
            .map(f => f.field_label);

        if (missingFields.length > 0) {
            toast({
                variant: "destructive",
                title: "❌ Champs manquants",
                description: `Veuillez remplir: ${missingFields.join(', ')}`
            });
            return;
        }

        // Validation regex si définie
        for (const field of userFields) {
            if (field.validation_regex && formData[field.field_key]) {
                const regex = new RegExp(field.validation_regex);
                if (!regex.test(formData[field.field_key])) {
                    toast({
                        variant: "destructive",
                        title: "❌ Format invalide",
                        description: field.validation_message || `Le format de "${field.field_label}" est invalide.`
                    });
                    return;
                }
            }
        }

        onSubmit(formData);
    };

    const renderField = (field: PaymentMethodField) => {
        switch (field.field_type) {
            case 'text':
            case 'tel':
            case 'email':
            case 'number':
                return (
                    <Input
                        type={field.field_type}
                        value={formData[field.field_key] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.field_key]: e.target.value }))}
                        placeholder={field.field_placeholder}
                        required={field.is_required}
                        disabled={isSubmitting}
                    />
                );

            case 'textarea':
                return (
                    <Textarea
                        value={formData[field.field_key] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.field_key]: e.target.value }))}
                        placeholder={field.field_placeholder}
                        required={field.is_required}
                        disabled={isSubmitting}
                        rows={3}
                    />
                );

            case 'file':
                return (
                    <div className="space-y-2">
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(field.field_key, file);
                            }}
                            required={field.is_required && !uploadedFiles[field.field_key]}
                            disabled={isSubmitting || isUploading}
                            className="cursor-pointer"
                        />
                        {uploadedFiles[field.field_key] && (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                                <Check className="h-4 w-4" />
                                <span>Fichier uploadé avec succès</span>
                            </div>
                        )}
                        {isUploading && (
                            <div className="text-sm text-muted-foreground">
                                Upload en cours...
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Instructions */}
            {method.instructions && (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                        {method.instructions}
                    </AlertDescription>
                </Alert>
            )}

            {/* Champs admin (affichage seul avec bouton copier) */}
            {adminFields.length > 0 && (
                <Card>
                    <CardContent className="pt-6 space-y-4">
                        <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                            Informations de paiement
                        </div>
                        {adminFields.map(field => (
                            <div key={field.id} className="space-y-2">
                                <Label className="text-sm font-medium">{field.field_label}</Label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 p-3 rounded-md bg-muted/50 font-mono text-sm break-all border">
                                        {field.field_value}
                                    </div>
                                    {field.show_copy_button && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => copyToClipboard(field.field_value || '', field.field_key)}
                                        >
                                            {copiedField === field.field_key ? (
                                                <Check className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Champs utilisateur */}
            {userFields.length > 0 && (
                <div className="space-y-4">
                    <div className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Vos informations
                    </div>
                    {userFields.map(field => (
                        <div key={field.id} className="space-y-2">
                            <Label htmlFor={field.field_key} className="text-sm font-medium">
                                {field.field_label}
                                {field.is_required && <span className="text-destructive ml-1">*</span>}
                            </Label>
                            {renderField(field)}
                            {field.help_text && (
                                <p className="text-xs text-muted-foreground flex items-start gap-1">
                                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span>{field.help_text}</span>
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Montant (lecture seule) */}
            <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">Montant</Label>
                <Input
                    id="amount"
                    type="text"
                    value={`${amount.toFixed(2)} USD`}
                    disabled
                    className="font-semibold text-lg"
                />
            </div>

            {/* Bouton de soumission */}
            <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || isUploading}
            >
                {isSubmitting ? "Envoi en cours..." : isUploading ? "Upload en cours..." : "Confirmer la demande de dépôt"}
            </Button>
        </form>
    );
};
