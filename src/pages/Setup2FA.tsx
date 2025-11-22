/**
 * Page pour configurer la 2FA (TOTP) pour la première fois
 * Affiche un QR code à scanner avec Google Authenticator ou similaire
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { use2FA, type MFAEnrollment } from '@/hooks/use2FA';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Shield, Smartphone, CheckCircle2 } from 'lucide-react';

export default function Setup2FA() {
    const navigate = useNavigate();
    const { enroll, verify, isLoading } = use2FA();

    const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'complete'>('intro');
    const [enrollment, setEnrollment] = useState<MFAEnrollment | null>(null);
    const [code, setCode] = useState('');

    const handleStart = async () => {
        const result = await enroll();
        if (result) {
            setEnrollment(result);
            setStep('scan');
        }
    };

    const handleVerify = async () => {
        if (!enrollment || code.length !== 6) {
            return;
        }

        const success = await verify(enrollment.id, code);
        if (success) {
            setStep('complete');
        }
    };

    const handleComplete = () => {
        navigate('/profile'); // ou /admin/settings
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <Card className="w-full max-w-md">
                {/* Étape 1 : Introduction */}
                {step === 'intro' && (
                    <>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-6 w-6" />
                                Activer l'Authentification à Deux Facteurs
                            </CardTitle>
                            <CardDescription>
                                Renforcez la sécurité de votre compte administrateur
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert>
                                <Smartphone className="h-4 w-4" />
                                <AlertTitle>Application requise</AlertTitle>
                                <AlertDescription>
                                    Vous aurez besoin d'une application d'authentification comme :
                                    <ul className="list-disc list-inside mt-2">
                                        <li>Google Authenticator</li>
                                        <li>Authy</li>
                                        <li>Microsoft Authenticator</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                                <h3 className="font-semibold">Comment ça marche ?</h3>
                                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                    <li>Scannez le QR code avec votre application</li>
                                    <li>Entrez le code à 6 chiffres généré</li>
                                    <li>Votre compte sera protégé !</li>
                                </ol>
                            </div>

                            <Button onClick={handleStart} disabled={isLoading} className="w-full">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Commencer
                            </Button>
                        </CardContent>
                    </>
                )}

                {/* Étape 2 : Scanner le QR Code */}
                {step === 'scan' && enrollment && (
                    <>
                        <CardHeader>
                            <CardTitle>Scannez le QR Code</CardTitle>
                            <CardDescription>
                                Utilisez votre application d'authentification
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-center p-4 bg-white rounded-lg">
                                <QRCodeSVG value={enrollment.uri} size={200} />
                            </div>

                            <Alert>
                                <AlertDescription>
                                    <strong>Impossible de scanner ?</strong>
                                    <br />
                                    Entrez manuellement ce code :
                                    <code className="block mt-2 p-2 bg-gray-100 rounded text-xs break-all">
                                        {enrollment.secret}
                                    </code>
                                </AlertDescription>
                            </Alert>

                            <Button onClick={() => setStep('verify')} className="w-full">
                                Suivant
                            </Button>
                        </CardContent>
                    </>
                )}

                {/* Étape 3 : Vérifier le code */}
                {step === 'verify' && enrollment && (
                    <>
                        <CardHeader>
                            <CardTitle>Vérifier le code</CardTitle>
                            <CardDescription>
                                Entrez le code à 6 chiffres de votre application
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Code de vérification</label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    className="text-center text-2xl tracking-widest"
                                    autoFocus
                                />
                            </div>

                            <Button
                                onClick={handleVerify}
                                disabled={code.length !== 6 || isLoading}
                                className="w-full"
                            >
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Vérifier
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => setStep('scan')}
                                className="w-full"
                            >
                                Retour
                            </Button>
                        </CardContent>
                    </>
                )}

                {/* Étape 4 : Complet */}
                {step === 'complete' && (
                    <>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="h-6 w-6" />
                                2FA Activée !
                            </CardTitle>
                            <CardDescription>
                                Votre compte est maintenant sécurisé
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert>
                                <AlertTitle>✨ Félicitations !</AlertTitle>
                                <AlertDescription>
                                    Votre compte administrateur est désormais protégé par l'authentification à deux facteurs.
                                    À chaque connexion, vous devrez entrer un code de votre application.
                                </AlertDescription>
                            </Alert>

                            <Alert variant="default">
                                <AlertTitle>⚠️ Important</AlertTitle>
                                <AlertDescription>
                                    Si vous perdez l'accès à votre application d'authentification, vous ne pourrez plus vous connecter.
                                    Contactez un super-admin pour réinitialiser votre 2FA.
                                </AlertDescription>
                            </Alert>

                            <Button onClick={handleComplete} className="w-full">
                                Terminer
                            </Button>
                        </CardContent>
                    </>
                )}
            </Card>
        </div>
    );
}
