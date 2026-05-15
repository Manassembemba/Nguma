import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TrendingUp, Shield, Zap, BarChart3, ChevronRight, Globe, Lock, Sparkles } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqData = [
  {
    question: "Comment fonctionne l'investissement sur Nguma ?",
    answer: "Vous créez un contrat d'investissement en déposant des fonds. Ces fonds sont utilisés pour des activités de trading, et vous recevez un profit mensuel fixe selon le taux défini dans votre contrat."
  },
  {
    question: "Quelle est la durée d'un contrat ?",
    answer: "La durée standard d'un contrat est de 10 mois. À la fin de cette période, votre capital initial est libéré."
  },
  {
    question: "Comment puis-je retirer mes profits ?",
    answer: "Les profits sont versés mensuellement sur votre solde disponible. Vous pouvez demander un retrait à tout moment vers votre compte bancaire ou portefeuille mobile money."
  },
  {
    question: "Mes investissements sont-ils sécurisés ?",
    answer: "Nous utilisons des protocoles de sécurité avancés et offrons une option d'assurance pour protéger votre capital contre les fluctuations imprévues du marché."
  }
];

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hash = window.location.hash;
      const isRecoveryFlow = hash.includes('type=recovery') || hash.includes('access_token=');
      if (session && !isRecoveryFlow) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30 selection:text-primary">
      {/* Navbar Minimaliste */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="h-8 w-8" />
            <span className="font-display font-bold text-xl tracking-tight">NGUMA</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-white">Connexion</Button>
            <Button size="sm" onClick={() => navigate("/auth")} className="rounded-full px-5 bg-primary hover:bg-primary/90 transition-all shadow-emerald">Démarrer</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow"></div>
          <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[13px] font-medium text-primary mb-8 animate-slide-up">
            <Sparkles className="h-3.5 w-3.5" /> 
            <span>L'élite du trading algorithmique</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tight mb-8 animate-slide-up [animation-delay:100ms]">
            <span className="text-gradient">Nguma</span><br />
            <span className="text-primary italic">Intelligence</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed animate-slide-up [animation-delay:200ms]">
            Accédez à la gestion automatisée de nouvelle génération. Sécurité institutionnelle et rendements optimisés par notre technologie propriétaire.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center animate-slide-up [animation-delay:300ms]">
            <Button
              size="xl"
              onClick={() => navigate("/auth")}
              className="rounded-full text-lg px-10 h-14 bg-primary hover:bg-primary/90 transition-all hover:scale-105 shadow-emerald group"
            >
              Créer mon compte
              <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="xl"
              variant="outline"
              onClick={() => navigate("/how-it-works")}
              className="rounded-full text-lg px-10 h-14 border-white/10 hover:bg-white/5 backdrop-blur-sm"
            >
              Voir le concept
            </Button>
          </div>
        </div>
      </main>

      {/* Bento Features */}
      <section className="max-w-7xl mx-auto px-4 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 glass-card rounded-[2rem] p-10 flex flex-col justify-between group hover:border-primary/20 transition-all">
            <div className="max-w-md">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-3xl font-bold mb-4 group-hover:text-primary transition-colors">Sécurité de Classe Bancaire</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Vos actifs sont protégés par une architecture décentralisée et des protocoles de sécurité multi-couches.
              </p>
            </div>
            <div className="mt-12 flex items-center gap-4 text-sm font-medium text-primary">
              <span>99.9% Disponibilité</span>
              <div className="h-1 w-1 rounded-full bg-white/20"></div>
              <span>Audit continu</span>
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-10 hover:border-primary/20 transition-all">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Automatisation Totale</h3>
            <p className="text-foreground/80 leading-relaxed">
              Le robot Nguma exécute vos contrats sur MetaTrader 5 sans intervention humaine nécessaire.
            </p>
          </div>

          <div className="glass-card rounded-[2rem] p-10 hover:border-primary/20 transition-all">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold mb-4">Transparence</h3>
            <p className="text-foreground/80 leading-relaxed">
              Suivi en temps réel de vos profits et retraits via votre interface personnalisée.
            </p>
          </div>

          <div className="md:col-span-2 glass-card rounded-[2rem] p-10 flex items-center justify-between group hover:border-primary/20 transition-all">
            <div>
              <h3 className="text-2xl font-bold mb-2">Support Elite</h3>
              <p className="text-foreground/80 max-w-xs">
                Une assistance dédiée pour vous accompagner dans votre croissance.
              </p>
            </div>
            <div className="flex -space-x-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 w-12 rounded-full border-4 border-[#111113] bg-secondary flex items-center justify-center overflow-hidden">
                  <img src={`https://i.pravatar.cc/150?u=${i+10}`} alt="Avatar" />
                </div>
              ))}
              <div className="h-12 w-12 rounded-full border-4 border-[#111113] bg-primary flex items-center justify-center text-xs font-bold">
                +12
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">Questions Fréquemment Posées</h2>
          <div className="h-1 w-20 bg-primary mx-auto rounded-full"></div>
        </div>
        <Accordion type="single" collapsible className="w-full space-y-4">
          {faqData.map((faq, index) => (
            <AccordionItem value={`item-${index}`} key={index} className="border-none glass-card rounded-2xl px-6">
              <AccordionTrigger className="text-lg font-bold hover:no-underline py-6">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-foreground/80 text-base leading-relaxed pb-6">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-4 py-32">
        <div className="relative rounded-[3rem] overflow-hidden p-20 text-center border border-primary/20">
          <div className="absolute inset-0 bg-primary/5"></div>
          <div className="relative z-10">
            <h2 className="text-5xl font-display font-bold mb-6">Prêt à rejoindre l'élite ?</h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
              Créez votre compte en quelques minutes et commencez à bénéficier de la puissance de Nguma.
            </p>
            <Button
              size="xl"
              onClick={() => navigate("/auth")}
              className="rounded-full px-12 h-16 text-lg bg-primary hover:bg-primary/90 shadow-emerald"
            >
              Ouvrir mon compte maintenant
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50">
            <img src="/logo.png" alt="Logo" className="h-6 w-6" />
            <span className="font-display font-bold tracking-tighter uppercase text-sm">NGUMA &copy; 2026</span>
          </div>
          <div className="flex gap-8 text-sm text-muted-foreground font-medium">
            <a href="#" className="hover:text-primary transition-colors">Termes</a>
            <a href="#" className="hover:text-primary transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-primary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;