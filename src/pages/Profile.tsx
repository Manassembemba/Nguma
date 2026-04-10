import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '@/services/profileService';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, User, Mail, Phone, MapPin, Shield, CheckCircle2, Camera, AlertCircle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, set, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { uploadAvatar } from '@/services/avatarService';
import { PasswordUpdateCard } from '@/components/PasswordUpdateCard';
import { COUNTRIES, getCountryDialCode } from '@/lib/countries';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const profileSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().min(2, { message: "Le prénom est requis." }),
  last_name: z.string().min(2, { message: "Le nom est requis." }),
  post_nom: z.string().optional(),
  phone: z.string()
    .min(10, { message: "Le numéro de téléphone doit contenir au moins 10 chiffres." })
    .regex(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
      { message: "Format de téléphone invalide. Ex: +243 123 456 789" }
    ),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  birth_date: z.date({ required_error: "La date de naissance est requise." })
    .max(subYears(new Date(), 18), {
      message: "Vous devez avoir au moins 18 ans pour investir.",
    }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfilePage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [wasProfileIncomplete, setWasProfileIncomplete] = useState(false);

  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      post_nom: '',
      phone: '',
      country: '',
      city: '',
      address: '',
    },
  });

  const selectedCountry = form.watch('country');

  const fetchCities = async (countryCode: string) => {
    if (!countryCode) {
      setCities([]);
      return;
    }
    setIsLoadingCities(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-cities', {
        body: { countryCode },
      });
      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error("Failed to fetch cities:", error);
      setCities(['Autre']);
    } finally {
      setIsLoadingCities(false);
    }
  };

  useEffect(() => {
    if (selectedCountry) {
      fetchCities(selectedCountry);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (profile) {
      form.reset({
        email: profile.email || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        post_nom: profile.post_nom || '',
        phone: profile.phone || '',
        country: profile.country || '',
        city: profile.city || '',
        address: profile.address || '',
        birth_date: profile.birth_date ? new Date(profile.birth_date) : undefined,
      });

      if (profile.country) {
        fetchCities(profile.country);
      }

      const isProfileIncomplete = (
        !profile.first_name || profile.first_name.trim() === '' ||
        !profile.last_name || profile.last_name.trim() === '' ||
        !profile.phone || profile.phone.trim() === '' ||
        !profile.birth_date
      );
      if (isProfileIncomplete) {
        setIsAlertOpen(true);
        setWasProfileIncomplete(true);
      }
    }
  }, [profile, form.reset]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      const dataToUpdate = {
        ...values,
        birth_date: values.birth_date ? format(values.birth_date, 'yyyy-MM-dd') : undefined,
      };
      return updateProfile(dataToUpdate);
    },
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(['profile'], updatedProfile);
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      if (wasProfileIncomplete) {
        toast({ title: "Profil complété !", description: "Redirection vers votre tableau de bord..." });
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        toast({ title: "Succès", description: "Votre profil a été mis à jour." });
      }
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        toast({ variant: "destructive", title: "Erreur", description: "Format non supporté." });
        return;
      }
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUploadClick = async () => {
    if (!selectedFile || !profile) return;
    setIsUploading(true);
    try {
      await uploadAvatar(selectedFile, profile.id);
      toast({ title: "Succès", description: "Photo mise à jour." });
      setSelectedFile(null);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const isComplete = (fieldName: keyof ProfileFormValues) => {
    const val = form.getValues(fieldName);
    return val && val.toString().trim() !== '';
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-8 animate-pulse bg-background">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <Skeleton className="h-[200px] rounded-3xl" />
          <Skeleton className="h-[400px] lg:col-span-2 rounded-3xl" />
        </div>
      </div>
    );
  }

  // Common classes for inputs and cards
  const cardCls = "border-none shadow-premium bg-white dark:bg-zinc-950 rounded-[2rem] overflow-hidden";
  const inputCls = "rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-primary";

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fade-in pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground">Paramètres</h1>
          <p className="text-sm md:text-base text-muted-foreground font-medium">Gérez votre identité et la sécurité de votre compte.</p>
        </div>
        {wasProfileIncomplete && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-2xl text-xs font-bold uppercase tracking-tight">
            <Loader2 className="h-3 w-3 animate-spin" />
            Action Requise : Profil Incomplet
          </div>
        )}
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-premium dark:bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              Accès Limité
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium leading-relaxed">
              Pour des raisons de conformité et de sécurité (KYC), vous devez être majeur et avoir un profil complet pour effectuer des opérations financières sur Nguma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="rounded-xl h-12 font-bold px-8 bg-primary">Je complète mon profil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Sidebar / Avatar Area */}
        <div className="lg:col-span-4 space-y-6">
          <Card className={cardCls}>
            <div className="h-24 bg-gradient-to-r from-primary/20 to-primary/5 dark:from-zinc-900 dark:to-zinc-900/50" />
            <CardContent className="px-6 pb-8 -mt-12 text-center space-y-4">
              <div className="relative inline-block group">
                <Avatar className="h-32 w-32 border-4 border-white dark:border-zinc-950 shadow-premium ring-4 ring-primary/5">
                  <AvatarImage src={preview || profile?.avatar_url || ''} className="object-cover" />
                  <AvatarFallback className="bg-zinc-100 dark:bg-zinc-900 text-2xl font-black">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2.5 bg-primary text-white rounded-full shadow-premium hover:scale-110 active:scale-95 transition-all duration-300 ring-4 ring-white dark:ring-zinc-950"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-black tracking-tight">{profile?.first_name} {profile?.last_name}</h2>
                <p className="text-sm font-medium text-muted-foreground">{profile?.email}</p>
              </div>

              {preview && selectedFile && (
                <Button 
                  onClick={handleUploadClick} 
                  disabled={isUploading}
                  className="w-full rounded-xl font-bold h-10 shadow-premium bg-primary hover:bg-primary/90"
                >
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Mettre à jour la photo
                </Button>
              )}

              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </CardContent>
          </Card>

          <Card className={cn(cardCls, "p-6")}>
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">Vérification KYC</CardTitle>
              <Shield className="h-4 w-4 text-primary opacity-50" />
            </div>
            <div className="space-y-3">
              {[
                { label: "Nom & Prénom", field: "last_name" },
                { label: "Téléphone Valide", field: "phone" },
                { label: "Majorité (18+)", field: "birth_date" }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{item.label}</span>
                  {isComplete(item.field as any) ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="general" className="w-full space-y-6">
            <TabsList className="bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl w-full sm:w-auto h-auto grid grid-cols-3 border border-zinc-200 dark:border-zinc-800">
              <TabsTrigger value="general" className="rounded-xl py-2.5 font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-elegant transition-all">
                <User className="h-4 w-4 mr-2" />
                Profil
              </TabsTrigger>
              <TabsTrigger value="contact" className="rounded-xl py-2.5 font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-elegant transition-all">
                <MapPin className="h-4 w-4 mr-2" />
                Contact
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-xl py-2.5 font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-elegant transition-all">
                <Shield className="h-4 w-4 mr-2" />
                Sécurité
              </TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <TabsContent value="general" className="space-y-6 animate-slide-up outline-none">
                  <Card className={cardCls}>
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-900">
                      <CardTitle className="text-lg font-bold">Informations Personnelles</CardTitle>
                      <CardDescription>Conformément à la réglementation, ces données doivent être exactes.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={form.control} name="first_name" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Prénom</FormLabel><FormControl><Input {...field} className={inputCls} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="last_name" render={({ field }) => (
                          <FormItem><FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Nom</FormLabel><FormControl><Input {...field} className={inputCls} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="post_nom" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Post-nom (Optionnel)</FormLabel><FormControl><Input {...field} value={field.value || ''} className={inputCls} /></FormControl><FormMessage /></FormItem>
                      )} />

                      <FormField control={form.control} name="birth_date" render={({ field }) => {
                        const [month, setMonth] = useState(field.value ?? subYears(new Date(), 18));
                        const maxDate = subYears(new Date(), 18); // Must be 18+

                        return (
                          <FormItem className="flex flex-col">
                            <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              Date de naissance
                              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black">18 ANS +</span>
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className={cn(inputCls, "justify-between text-left font-medium", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "PPP", { locale: fr }) : <span>Choisir votre date de naissance</span>}
                                    <CalendarIcon className="h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 rounded-[2rem] border-none shadow-premium overflow-hidden dark:bg-zinc-950" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  month={month}
                                  onMonthChange={setMonth}
                                  disabled={(date) => date > maxDate || date < new Date("1940-01-01")}
                                  initialFocus
                                  className="p-4"
                                  components={{
                                    Caption: () => {
                                      const currentYear = new Date().getFullYear();
                                      const years = Array.from({ length: currentYear - 1939 }, (_, i) => currentYear - 18 - i);
                                      const months = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('fr-FR', { month: 'long' }));
                                      return (
                                        <div className="flex justify-center gap-2 mb-4 px-2">
                                          <Select value={String(month.getMonth())} onValueChange={(val) => setMonth(m => set(m, { month: parseInt(val) }))}>
                                            <SelectTrigger className="h-9 rounded-lg bg-zinc-50 dark:bg-zinc-900 border-none"><SelectValue /></SelectTrigger>
                                            <SelectContent className="dark:bg-zinc-900 border-zinc-800">{months.map((m, i) => <SelectItem key={m} value={String(i)}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}</SelectContent>
                                          </Select>
                                          <Select value={String(month.getFullYear())} onValueChange={(val) => setMonth(m => set(m, { year: parseInt(val) }))}>
                                            <SelectTrigger className="h-9 rounded-lg bg-zinc-50 dark:bg-zinc-900 border-none"><SelectValue /></SelectTrigger>
                                            <SelectContent className="max-h-[200px] dark:bg-zinc-900 border-zinc-800">{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                          </Select>
                                        </div>
                                      );
                                    },
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription className="text-[10px]">L'investissement est réservé aux personnes majeures.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="contact" className="space-y-6 animate-slide-up outline-none">
                  <Card className={cardCls}>
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-900">
                      <CardTitle className="text-lg font-bold">Coordonnées & Localisation</CardTitle>
                      <CardDescription>Ces informations sont nécessaires pour vos retraits.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5 opacity-60" /> Numéro de Téléphone</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} placeholder={selectedCountry ? `${getCountryDialCode(selectedCountry)} ...` : "+..."} className={inputCls} /></FormControl>
                          <FormDescription className="text-[10px] font-bold text-primary/60">Utilisé pour la réception des codes de retrait (OTP).</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={form.control} name="country" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Pays de résidence</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl><SelectTrigger className={inputCls}><SelectValue placeholder="Sélectionner" /></SelectTrigger></FormControl>
                              <SelectContent className="max-h-[300px] rounded-2xl dark:bg-zinc-900 border-zinc-800">{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="city" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Ville</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedCountry || isLoadingCities}>
                              <FormControl><SelectTrigger className={inputCls}><SelectValue placeholder={isLoadingCities ? "..." : "Sélectionner"} /></SelectTrigger></FormControl>
                              <SelectContent className="max-h-[300px] rounded-2xl dark:bg-zinc-900 border-zinc-800">{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Adresse Résidentielle</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="Ex: 12, Avenue de la Paix" className={inputCls} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-6 animate-slide-up outline-none">
                  <Card className={cardCls}>
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-900">
                      <CardTitle className="text-lg font-bold">Compte & Sécurité</CardTitle>
                      <CardDescription>Protégez l'accès à vos investissements.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5 opacity-60" /> Adresse Email (Identifiant)</FormLabel>
                          <FormControl><Input {...field} disabled className={cn(inputCls, "opacity-60 bg-zinc-100 dark:bg-zinc-900/50")} /></FormControl>
                          <FormDescription className="text-[10px]">L'email ne peut être modifié pour des raisons de sécurité.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  {/* Password update card remains as its own component but we'll ensure it matches the style */}
                  <PasswordUpdateCard />
                </TabsContent>

                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit" 
                    disabled={mutation.isPending} 
                    className="rounded-2xl px-12 h-14 font-black uppercase tracking-widest text-xs shadow-premium bg-primary hover:bg-primary/90 group"
                  >
                    {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Sauvegarder mon profil
                  </Button>
                </div>
              </form>
            </Form>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;