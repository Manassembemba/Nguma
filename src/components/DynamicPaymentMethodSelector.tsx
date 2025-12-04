import { useState, ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getActiveDepositMethods, PaymentMethod, PaymentCategory } from '@/services/paymentMethodsService';
import * as Icons from 'lucide-react';
import { Loader2, ChevronRight } from 'lucide-react';

interface Props {
    onSelect: (method: PaymentMethod) => void;
    type: 'deposit' | 'withdrawal';
}

export const DynamicPaymentMethodSelector = ({ onSelect, type }: Props) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const { data: methods, isLoading } = useQuery({
        queryKey: ['paymentMethods', type],
        queryFn: getActiveDepositMethods, // TODO: Add getActiveWithdrawalMethods for withdrawal
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!methods || methods.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-6xl mb-4">💳</div>
                <h3 className="text-xl font-semibold mb-2">Aucune méthode disponible</h3>
                <p className="text-muted-foreground">
                    Aucune méthode de paiement n'est actuellement disponible.
                </p>
            </div>
        );
    }

    // Grouper par catégorie
    const methodsByCategory = methods.reduce((acc, method) => {
        const categoryId = method.category_id || 'uncategorized';
        if (!acc[categoryId]) {
            acc[categoryId] = {
                category: method.category,
                methods: []
            };
        }
        acc[categoryId].methods.push(method);
        return acc;
    }, {} as Record<string, { category?: PaymentCategory; methods: PaymentMethod[] }>);

    // Si une catégorie est sélectionnée, afficher ses méthodes
    if (selectedCategory && methodsByCategory[selectedCategory]) {
        const { category, methods: categoryMethods } = methodsByCategory[selectedCategory];

        return (
            <div className="space-y-4">
                {/* Bouton retour */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className="mb-2"
                >
                    <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                    Retour aux catégories
                </Button>

                {/* Titre de la catégorie */}
                {category && (
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold">{category.name}</h3>
                        {category.description && (
                            <p className="text-sm text-muted-foreground">{category.description}</p>
                        )}
                    </div>
                )}

                {/* Liste des méthodes */}
                <div className="grid gap-3">
                    {categoryMethods.map((method) => {
                        const IconComponent = (Icons[method.icon as keyof typeof Icons] as ElementType) || Icons.Circle;

                        return (
                            <Button
                                key={method.id}
                                variant="outline"
                                className="justify-start h-auto p-4 hover:bg-accent hover:border-primary transition-all"
                                onClick={() => onSelect(method)}
                            >
                                <div className="flex items-start gap-4 w-full">
                                    <div className="flex-shrink-0 mt-1">
                                        {method.image_url ? (
                                            <img
                                                src={method.image_url}
                                                alt={method.name}
                                                className="h-10 w-10 object-contain rounded"
                                            />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <IconComponent className="h-5 w-5 text-primary" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="font-semibold text-base">{method.name}</div>
                                        {method.description && (
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {method.description}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            {method.processing_time && (
                                                <Badge variant="secondary" className="text-xs">
                                                    ⏱️ {method.processing_time}
                                                </Badge>
                                            )}
                                            {method.requires_proof && type === 'deposit' && (
                                                <Badge variant="outline" className="text-xs">
                                                    📸 Preuve requise
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
                                </div>
                            </Button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Afficher les catégories
    return (
        <div className="space-y-4">
            <div className="mb-4">
                <h3 className="text-lg font-semibold">Choisissez une catégorie</h3>
                <p className="text-sm text-muted-foreground">
                    Sélectionnez le type de paiement que vous souhaitez utiliser
                </p>
            </div>

            <div className="grid gap-3">
                {Object.entries(methodsByCategory).map(([categoryId, { category, methods: categoryMethods }]) => {
                    const IconComponent = (category?.icon
                        ? Icons[category.icon as keyof typeof Icons]
                        : Icons.Folder) as ElementType;

                    return (
                        <Card
                            key={categoryId}
                            className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                            onClick={() => setSelectedCategory(categoryId)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0">
                                        {category?.image_url ? (
                                            <img
                                                src={category.image_url}
                                                alt={category.name}
                                                className="h-12 w-12 object-contain rounded-lg"
                                            />
                                        ) : (
                                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <IconComponent className="h-6 w-6 text-primary" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <CardTitle className="text-base">
                                            {category?.name || 'Autres méthodes'}
                                        </CardTitle>
                                        {category?.description && (
                                            <CardDescription className="mt-1">
                                                {category.description}
                                            </CardDescription>
                                        )}
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Separator className="mb-3" />
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                        {categoryMethods.length} méthode{categoryMethods.length > 1 ? 's' : ''} disponible{categoryMethods.length > 1 ? 's' : ''}
                                    </span>
                                    <div className="flex -space-x-2">
                                        {categoryMethods.slice(0, 3).map((method, index) => {
                                            if (method.image_url) {
                                                return (
                                                    <img
                                                        key={method.id}
                                                        src={method.image_url}
                                                        alt={method.name}
                                                        className="h-6 w-6 rounded-full bg-background border-2 border-background object-contain"
                                                        style={{ zIndex: 3 - index }}
                                                    />
                                                );
                                            }
                                            const MethodIcon = (Icons[method.icon as keyof typeof Icons] || Icons.Circle) as ElementType;
                                            return (
                                                <div
                                                    key={method.id}
                                                    className="h-6 w-6 rounded-full bg-background border-2 border-background flex items-center justify-center"
                                                    style={{ zIndex: 3 - index }}
                                                >
                                                    <MethodIcon className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                            );
                                        })}
                                        {categoryMethods.length > 3 && (
                                            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                                                +{categoryMethods.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
