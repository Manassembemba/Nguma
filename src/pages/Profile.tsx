import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '@/services/profileService';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, User, Mail, Phone, MapPin, Shield, CheckCircle2, Camera, AlertCircle, FileText, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { submitKYC } from '@/services/profileService';
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
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [kycIdFront, setKycIdFront] = useState<File | null>(null);
  const [kycResidence, setKycResidence] = useState<File | null>(null);
  const [kycPreviews, setKycPreviews] = useState<{front?: string, residence?: string}>({});
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);
  const [kycDocType, setKycDocType] = useState('ID_CARD');
  const [kycStep, setKycStep] = useState(1);
  const kycInputRef = useRef<HTMLInputElement>(null);
  
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const [activeTab, setActiveTab] = useState(queryParams.get('tab') || 'general');

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

  const handleKycFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type)) {
        toast({ variant: "destructive", title: "Erreur", description: "Format non supporté (JPG, PNG, PDF uniquement)." });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Erreur", description: "Fichier trop lourd (Max 5Mo)." });
        return;
      }

      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

      if (kycStep === 1) {
        setKycIdFront(file);
        setKycPreviews(prev => ({ ...prev, front: previewUrl }));
      } else if (kycStep === 2) {
        setKycResidence(file);
        setKycPreviews(prev => ({ ...prev, residence: previewUrl }));
      }
    }
  };

  const handleKycSubmit = async () => {
    if (!kycIdFront || !kycResidence || !profile) return;
    setIsSubmittingKyc(true);
    try {
      const uploadFile = async (file: File, suffix: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile.id}/${Date.now()}_${suffix}.${fileExt}`;
        const { data, error } = await supabase.storage.from('kyc-documents').upload(fileName, file);
        if (error) throw error;
        return data.path;
      };

      const [frontPath, residencePath] = await Promise.all([
        uploadFile(kycIdFront, 'id_front'),
        uploadFile(kycResidence, 'residence')
      ]);

      await submitKYC(frontPath, '', residencePath, kycDocType);
      
      toast({ title: "Demande soumise", description: "Votre dossier KYC complet est en cours d'examen." });
      setKycIdFront(null);
      setKycResidence(null);
      setKycPreviews({});
      setKycStep(1);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setIsSubmittingKyc(false);
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
  const inputCls = "rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 focus:ring-primary text-zinc-900 dark:text-zinc-100 font-bold";

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fade-in pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50">Paramètres</h1>
          <p className="text-sm md:text-base text-zinc-700 dark:text-zinc-400 font-bold">Gérez votre identité et la sécurité de votre compte.</p>
        </div>
        {wasProfileIncomplete && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-2xl text-xs font-black uppercase tracking-tight">
            <Loader2 className="h-3 w-3 animate-spin" />
            Action Requise : Profil Incomplet
          </div>
        )}
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-premium dark:bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              Accès Limité
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-bold leading-relaxed text-zinc-700 dark:text-zinc-300">
              Pour des raisons de conformité et de sécurité (KYC), vous devez être majeur et avoir un profil complet pour effectuer des opérations financières sur Nguma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="rounded-xl h-12 font-black px-8 bg-primary text-white shadow-lg">Je complète mon profil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Sidebar / Avatar Area */}
        <div className="lg:col-span-4 space-y-6">
          <Card className={cardCls}>
            <div className="h-24 bg-gradient-to-r from-primary/25 to-primary/10 dark:from-zinc-900 dark:to-zinc-900/50" />
            <CardContent className="px-6 pb-8 -mt-12 text-center space-y-4">
              <div className="relative inline-block group">
                <Avatar className="h-32 w-32 border-4 border-white dark:border-zinc-950 shadow-2xl ring-4 ring-primary/10">
                  <AvatarImage src={preview || profile?.avatar_url || ''} className="object-cover" />
                  <AvatarFallback className="bg-zinc-100 dark:bg-zinc-900 text-2xl font-black text-zinc-800 dark:text-zinc-200">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2.5 bg-primary text-white rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 ring-4 ring-white dark:ring-zinc-950"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">{profile?.first_name} {profile?.last_name}</h2>
                <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">{profile?.email}</p>
              </div>

              {preview && selectedFile && (
                <Button 
                  onClick={handleUploadClick} 
                  disabled={isUploading}
                  className="w-full rounded-xl font-black h-10 shadow-premium bg-primary hover:bg-primary/90"
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
              <CardTitle className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-400">Vérification KYC</CardTitle>
              <Shield className="h-4 w-4 text-primary opacity-90" />
            </div>
            <div className="space-y-3">
              {[
                { label: "Nom & Prénom", field: "last_name" },
                { label: "Téléphone Valide", field: "phone" },
                { label: "Majorité (18+)", field: "birth_date" },
                { label: "Identité Vérifiée", customCheck: profile?.kyc_status === 'verified' }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50">
                  <span className="text-[11px] font-black text-zinc-700 dark:text-zinc-400 uppercase tracking-tight">{item.label}</span>
                  {(item.customCheck !== undefined ? item.customCheck : isComplete(item.field as any)) ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                  )}
                </div>
              ))}
            </div>
            {profile?.kyc_status === 'pending' && (
              <p className="mt-4 text-[10px] font-bold text-center text-amber-600 bg-amber-50 py-1.5 rounded-lg border border-amber-100 animate-pulse">
                Examen de votre identité en cours...
              </p>
            )}
            {profile?.kyc_status === 'verified' && (
              <p className="mt-4 text-[10px] font-bold text-center text-emerald-600 bg-emerald-50 py-1.5 rounded-lg border border-emerald-100">
                Identité confirmée avec succès
              </p>
            )}
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <TabsList className="bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl w-full sm:w-auto h-auto grid grid-cols-4 border border-zinc-200 dark:border-zinc-800">
              <TabsTrigger value="general" className="rounded-xl py-2.5 font-black text-zinc-600 dark:text-zinc-400 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-50 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-elegant transition-all">
                <User className="h-4 w-4 mr-2" />
                Profil
              </TabsTrigger>
              <TabsTrigger value="contact" className="rounded-xl py-2.5 font-black text-zinc-600 dark:text-zinc-400 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-50 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-elegant transition-all">
                <MapPin className="h-4 w-4 mr-2" />
                Contact
              </TabsTrigger>
              <TabsTrigger value="verification" className="rounded-xl py-2.5 font-black text-zinc-600 dark:text-zinc-400 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-50 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-elegant transition-all">
                <FileText className="h-4 w-4 mr-2" />
                Identité
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-xl py-2.5 font-black text-zinc-600 dark:text-zinc-400 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-50 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-950 data-[state=active]:shadow-elegant transition-all">
                <Shield className="h-4 w-4 mr-2" />
                Sécurité
              </TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <TabsContent value="general" className="space-y-6 animate-slide-up outline-none">
                  <Card className={cardCls}>
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-900">
                      <CardTitle className="text-lg font-black text-zinc-900 dark:text-zinc-50">Informations Personnelles</CardTitle>
                      <CardDescription className="font-bold text-zinc-600 dark:text-zinc-400">Conformément à la réglementation, ces données doivent être exactes.</CardDescription>
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
                        const maxDate = subYears(new Date(), 18);

                        return (
                          <FormItem className="flex flex-col">
                            <FormLabel className="font-black text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-300 flex items-center gap-2">
                              Date de naissance
                              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black">18 ANS +</span>
                            </FormLabel>
                            <Popover open={calendarOpen} onOpenChange={setCalendarOpen} modal={true}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button 
                                    variant="outline" 
                                    className={cn(
                                      "h-11 rounded-xl border-zinc-300 bg-zinc-50/50 dark:bg-zinc-900 dark:border-zinc-800 justify-between text-left font-bold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 transition-all shadow-sm",
                                      !field.value && "text-zinc-500"
                                    )}
                                  >
                                    {field.value ? format(field.value, "PPP", { locale: fr }) : <span>Choisir votre date de naissance</span>}
                                    <CalendarIcon className="h-4 w-4 text-zinc-500" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent 
                                className="w-auto p-0 rounded-[2rem] border-none shadow-2xl dark:bg-zinc-950 overflow-hidden" 
                                align="start"
                              >
                                <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                                  <div className="flex gap-2">
                                    <Select 
                                      value={String(month.getMonth())} 
                                      onValueChange={(val) => setMonth(m => set(m, { month: parseInt(val) }))}
                                    >
                                      <SelectTrigger className="h-9 rounded-lg border-zinc-200 bg-white dark:bg-zinc-950 shadow-sm text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px] rounded-xl">
                                        {Array.from({ length: 12 }, (_, i) => (
                                          <SelectItem key={i} value={String(i)} className="text-xs font-bold">
                                            {format(new Date(0, i), 'MMMM', { locale: fr })}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Select 
                                      value={String(month.getFullYear())} 
                                      onValueChange={(val) => setMonth(m => set(m, { year: parseInt(val) }))}
                                    >
                                      <SelectTrigger className="h-9 rounded-lg border-zinc-200 bg-white dark:bg-zinc-950 shadow-sm text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px] rounded-xl">
                                        {Array.from({ length: 85 }, (_, i) => {
                                          const year = new Date().getFullYear() - 18 - i;
                                          return <SelectItem key={year} value={String(year)} className="text-xs font-bold">{year}</SelectItem>;
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={(date) => {
                                    field.onChange(date);
                                    setCalendarOpen(false); // Close on select
                                  }}
                                  month={month}
                                  onMonthChange={setMonth}
                                  disabled={(date) => date > maxDate || date < new Date("1940-01-01")}
                                  initialFocus
                                  className="p-3"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormDescription className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">L'investissement est réservé aux personnes majeures.</FormDescription>
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
                      <CardTitle className="text-lg font-black text-zinc-900 dark:text-zinc-50">Coordonnées & Localisation</CardTitle>
                      <CardDescription className="font-bold text-zinc-700 dark:text-zinc-400">Ces informations sont nécessaires pour vos retraits.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-black text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-300 flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" /> Numéro de Téléphone</FormLabel>
                          <FormControl><Input {...field} value={field.value || ''} placeholder={selectedCountry ? `${getCountryDialCode(selectedCountry)} ...` : "+..."} className={inputCls} /></FormControl>
                          <FormDescription className="text-[10px] font-black text-primary/80">Utilisé pour la réception des codes de retrait (OTP).</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={form.control} name="country" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-black text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-300">Pays de résidence</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 shadow-sm transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-bold">
                                  <SelectValue placeholder="Sélectionner un pays" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px] rounded-2xl shadow-2xl border-zinc-200 dark:border-zinc-800">
                                {COUNTRIES.map((c) => (
                                  <SelectItem key={c.code} value={c.code} className="py-3 font-bold text-zinc-800 dark:text-zinc-200">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">{c.flag}</span>
                                      <span>{c.name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="city" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-black text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-300">Ville</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedCountry || isLoadingCities}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 shadow-sm transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-bold">
                                  {isLoadingCities ? (
                                    <div className="flex items-center gap-2">
                                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                      <span className="text-zinc-600">Chargement...</span>
                                    </div>
                                  ) : (
                                    <SelectValue placeholder="Sélectionner une ville" />
                                  )}
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px] rounded-2xl shadow-2xl border-zinc-200 dark:border-zinc-800">
                                {cities.map((c) => (
                                  <SelectItem key={c} value={c} className="py-3 font-bold text-zinc-800 dark:text-zinc-200">{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem><FormLabel className="font-black text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-300">Adresse Résidentielle</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="Ex: 12, Avenue de la Paix" className={inputCls} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="verification" className="space-y-6 animate-slide-up outline-none">
                  <Card className={cardCls}>
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg font-black text-zinc-900 dark:text-zinc-50">Vérification d'Identité (KYC)</CardTitle>
                          <CardDescription className="font-bold text-zinc-700 dark:text-zinc-400">Suivez les étapes pour valider votre compte.</CardDescription>
                        </div>
                        {profile?.kyc_status === 'verified' && <Badge className="bg-emerald-500 text-white border-none px-3 rounded-full">Vérifié</Badge>}
                        {profile?.kyc_status === 'pending' && <Badge className="bg-amber-500 text-white border-none px-3 rounded-full animate-pulse">En attente</Badge>}
                        {profile?.kyc_status === 'rejected' && <Badge className="bg-red-500 text-white border-none px-3 rounded-full">Refusé</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {profile?.kyc_status === 'rejected' && (
                        <Alert className="bg-red-50 border-red-200 text-red-800 rounded-2xl p-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="font-bold ml-2">
                            Votre demande précédente a été refusée : <span className="italic">"{profile.kyc_rejection_reason}"</span>. Veuillez soumettre un nouveau dossier complet.
                          </AlertDescription>
                        </Alert>
                      )}

                      {profile?.kyc_status === 'verified' ? (
                        <div className="text-center py-12 space-y-4">
                          <div className="mx-auto w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                          </div>
                          <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Votre identité est vérifiée</h3>
                          <p className="text-zinc-600 dark:text-zinc-400 font-bold max-w-sm mx-auto">
                            Merci d'avoir complété votre vérification. Vous avez désormais un accès complet à toutes les fonctionnalités de Nguma.
                          </p>
                        </div>
                      ) : profile?.kyc_status === 'pending' ? (
                        <div className="text-center py-12 space-y-4">
                          <div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                            <Loader2 className="h-10 w-10 text-amber-600 animate-spin" />
                          </div>
                          <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Vérification en cours</h3>
                          <p className="text-zinc-600 dark:text-zinc-400 font-bold max-w-sm mx-auto">
                            Votre dossier est actuellement en cours d'examen. Nos équipes analysent vos documents et vous serez informé dès la fin de la vérification, qui peut prendre jusqu'à une semaine.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {/* Stepper Header */}
                          <div className="flex justify-between items-center max-w-sm mx-auto relative">
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-100 dark:bg-zinc-800 -translate-y-1/2 -z-0" />
                            {[1, 2].map((step) => (
                              <div 
                                key={step} 
                                className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm z-10 transition-all duration-500",
                                  kycStep >= step ? "bg-primary text-white shadow-lg scale-110" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                )}
                              >
                                {step}
                              </div>
                            ))}
                          </div>

                          <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50">
                              {kycStep === 1 ? "Étape 1 : Pièce d'Identité (Recto)" : 
                               "Étape 2 : Justificatif de Domicile"}
                            </h3>
                            <p className="text-sm text-zinc-500 font-bold">
                              {kycStep === 1 ? "Téléchargez la face avant de votre carte d'identité ou passeport." : 
                               "Facture d'eau/électricité ou certificat de résidence de moins de 3 mois."}
                            </p>
                          </div>

                          {kycStep === 1 && (
                            <div className="max-w-sm mx-auto space-y-4">
                              <Select value={kycDocType} onValueChange={setKycDocType}>
                                <SelectTrigger className="rounded-xl h-11 border-zinc-300 dark:border-zinc-800 font-bold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl font-bold">
                                  <SelectItem value="ID_CARD">Carte d'Identité</SelectItem>
                                  <SelectItem value="PASSPORT">Passeport</SelectItem>
                                  <SelectItem value="DRIVING_LICENSE">Permis de Conduire</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="max-w-xl mx-auto space-y-6">
                            <div 
                              onClick={() => !isSubmittingKyc && kycInputRef.current?.click()}
                              className={cn(
                                "border-2 border-dashed rounded-[2rem] p-10 text-center cursor-pointer transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50 min-h-[250px] flex flex-col items-center justify-center",
                                (kycStep === 1 && kycIdFront) || (kycStep === 2 && kycIdBack) || (kycStep === 3 && kycResidence) ? "border-primary bg-primary/5" : "border-zinc-200 dark:border-zinc-800",
                                isSubmittingKyc && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <input 
                                type="file" 
                                ref={kycInputRef} 
                                className="hidden" 
                                onChange={handleKycFileChange}
                                accept="image/*,application/pdf"
                              />
                              
                              {(kycStep === 1 && kycPreviews.front) || (kycStep === 2 && kycPreviews.back) || (kycStep === 3 && kycPreviews.residence) ? (
                                <div className="relative w-full max-w-xs aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-white dark:border-zinc-900">
                                  <img 
                                    src={kycStep === 1 ? kycPreviews.front : kycStep === 2 ? kycPreviews.back : kycPreviews.residence} 
                                    className="w-full h-full object-cover" 
                                    alt="Preview" 
                                  />
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (kycStep === 1) setKycIdFront(null);
                                      else if (kycStep === 2) setKycIdBack(null);
                                      else setKycResidence(null);
                                      setKycPreviews(prev => {
                                        const n = { ...prev };
                                        if (kycStep === 1) delete n.front;
                                        else if (kycStep === 2) delete n.back;
                                        else delete n.residence;
                                        return n;
                                      });
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (kycStep === 1 && kycIdFront) || (kycStep === 2 && kycIdBack) || (kycStep === 3 && kycResidence) ? (
                                <div className="space-y-3">
                                  <FileText className="mx-auto h-16 w-16 text-primary" />
                                  <p className="font-black text-zinc-900 dark:text-zinc-50">
                                    {kycStep === 1 ? kycIdFront?.name : kycStep === 2 ? kycIdBack?.name : kycResidence?.name}
                                  </p>
                                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); kycInputRef.current?.click(); }} className="text-primary font-bold">Changer de fichier</Button>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <Upload className="h-10 w-10 text-zinc-400" />
                                  </div>
                                  <p className="text-xl font-black text-zinc-900 dark:text-zinc-50">Cliquez pour télécharger</p>
                                  <p className="text-sm text-zinc-500 font-bold">Format accepté : JPG, PNG ou PDF (Max 5Mo)</p>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-4">
                              {kycStep > 1 && (
                                <Button 
                                  variant="outline" 
                                  onClick={() => setKycStep(kycStep - 1)}
                                  className="h-14 rounded-2xl font-bold flex-1 border-zinc-300 dark:border-zinc-800"
                                >
                                  Précédent
                                </Button>
                              )}
                              
                              {kycStep < 2 ? (
                                <Button 
                                  disabled={(kycStep === 1 && !kycIdFront)}
                                  onClick={() => setKycStep(kycStep + 1)}
                                  className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-premium bg-primary hover:bg-primary/90 flex-1"
                                >
                                  Étape suivante
                                </Button>
                              ) : (
                                <Button 
                                  onClick={handleKycSubmit}
                                  disabled={!kycResidence || isSubmittingKyc}
                                  className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-premium bg-emerald-600 hover:bg-emerald-700 flex-1"
                                >
                                  {isSubmittingKyc ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                                  Soumettre mon dossier complet
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-6 animate-slide-up outline-none">
                  <Card className={cardCls}>
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-900">
                      <CardTitle className="text-lg font-black text-zinc-900 dark:text-zinc-50">Compte & Sécurité</CardTitle>
                      <CardDescription className="font-bold text-zinc-700 dark:text-zinc-400">Protégez l'accès à vos investissements.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-black text-xs uppercase tracking-widest text-zinc-800 dark:text-zinc-300 flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary" /> Adresse Email (Identifiant)</FormLabel>
                          <FormControl><Input {...field} disabled className={cn(inputCls, "opacity-70 bg-zinc-100 dark:bg-zinc-900/50 font-bold")} /></FormControl>
                          <FormDescription className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">L'email ne peut être modifié pour des raisons de sécurité.</FormDescription>
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
