import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { getAccountingEntries } from "@/services/accountingService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Loader2, FileText, Search, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";

const getGroupSummary = (group: any[]) => {
    if (group.length === 1) {
        const entry = group[0];
        const isDebitToAsset = entry.debit_account_name.includes('Banque') || entry.debit_account_name.includes('Crypto');
        return {
            description: entry.description,
            date: entry.transaction_date,
            netAmount: isDebitToAsset ? entry.amount : -entry.amount,
        };
    }

    const contractId = group[0].description.split('#')[1]?.substring(0, 8);
    const depositEntry = group.find(e => e.description.includes('Dépôt'));
    if (depositEntry) return { description: `Dépôt (Contrat #${contractId})`, date: depositEntry.transaction_date, netAmount: depositEntry.amount };
    
    const capitalEntry = group.find(e => e.description.includes('Allocation de capital'));
    const feeEntry = group.find(e => e.description.includes('Revenus sur frais'));
    
    return {
        description: `Création du Contrat #${contractId}`,
        date: group[0].transaction_date,
        netAmount: -(capitalEntry?.amount || 0) - (feeEntry?.amount || 0),
    };
};

const LedgerPage = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [datePreset, setDatePreset] = useState("all");
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

    const { data: entries, isLoading } = useQuery({
        queryKey: ["accountingEntries", dateFrom, dateTo, searchQuery],
        queryFn: () => getAccountingEntries(dateFrom, dateTo, searchQuery),
    });

    const groupedEntries = useMemo(() => {
        if (!entries) return [];
        
        const groups = new Map<string, typeof entries>();
        
        entries.forEach(entry => {
            const groupKey = entry.description.split('#')[1]?.substring(0, 8) || entry.id;
            
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey)?.push(entry);
        });
        
        return Array.from(groups.values());
    }, [entries]);

    const toggleGroup = (groupKey: string) => {
        setExpandedGroupKeys(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupKey)) {
                newSet.delete(groupKey);
            } else {
                newSet.add(groupKey);
            }
            return newSet;
        });
    };

    const handlePresetChange = (value: string) => {
        setDatePreset(value);
        const today = new Date();

        switch (value) {
            case "today":
                setDateFrom(format(startOfDay(today), "yyyy-MM-dd"));
                setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
                break;
            case "week":
                setDateFrom(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
                break;
            case "month":
                setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"));
                setDateTo(format(endOfDay(today), "yyyy-MM-dd"));
                break;
            case "custom":
                setDateFrom("");
                setDateTo("");
                break;
            case "all":
                setDateFrom("");
                setDateTo("");
                break;
        }
    };

    return (
        <div className="p-8 space-y-8 neon-grid-bg min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-text-primary mb-2">Grand Livre</h1>
                    <p className="text-muted-foreground">Historique complet des écritures comptables.</p>
                </div>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm border-border">
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Écritures
                            </CardTitle>

                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher par description..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-center justify-end">
                            <Select value={datePreset} onValueChange={handlePresetChange}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Période" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tout l'historique</SelectItem>
                                    <SelectItem value="today">Aujourd'hui</SelectItem>
                                    <SelectItem value="week">Cette semaine</SelectItem>
                                    <SelectItem value="month">Ce mois</SelectItem>
                                    <SelectItem value="custom">Personnalisé</SelectItem>
                                </SelectContent>
                            </Select>

                            {datePreset === 'custom' && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Du:</span>
                                        <Input
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            className="w-[150px]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Au:</span>
                                        <Input
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            className="w-[150px]"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : entries && entries.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Compte Débit</TableHead>
                                    <TableHead>Compte Crédit</TableHead>
                                    <TableHead className="text-right">Montant</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedEntries.map((group) => {
                                    const groupKey = group[0].description.split('#')[1]?.substring(0, 8) || group[0].id;
                                    const isExpanded = expandedGroupKeys.has(groupKey);
                                    const summary = getGroupSummary(group);

                                    return (
                                        <React.Fragment key={groupKey}>
                                            <TableRow className="bg-muted/20 hover:bg-muted/50 cursor-pointer" onClick={() => toggleGroup(groupKey)}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                        {new Date(summary.date).toLocaleDateString()}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-bold text-lg">{summary.description}</TableCell>
                                                <TableCell colSpan={2}></TableCell>
                                                <TableCell className={`text-right font-bold text-lg ${summary.netAmount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {formatCurrency(summary.netAmount)}
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && group.map((entry) => (
                                                <TableRow key={entry.id} className="bg-card hover:bg-muted/30">
                                                    <TableCell className="pl-10 text-sm text-muted-foreground">{new Date(entry.transaction_date).toLocaleTimeString()}</TableCell>
                                                    <TableCell className="pl-6 text-sm">{entry.description}</TableCell>
                                                    <TableCell className="text-sm">{entry.debit_account_name}</TableCell>
                                                    <TableCell className="text-sm">{entry.credit_account_name}</TableCell>
                                                    <TableCell className="text-right text-sm font-mono">
                                                        {formatCurrency(entry.amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Aucune écriture comptable trouvée.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default LedgerPage;
