import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button"; // Added Button import
import { useNavigate } from "react-router-dom"; // Added useNavigate import

const HowItWorksPage = () => {
  const navigate = useNavigate(); // Initialize useNavigate
  const steps = [
    {
      number: "01",
      title: "Inscription Rapide",
      description: "Créez votre compte en quelques minutes. Une fois votre profil créé, vous avez accès à votre portefeuille personnel et à toutes les fonctionnalités de la plateforme.",
    },
    {
      number: "02",
      title: "Dépôt Sécurisé",
      description: "Effectuez un dépôt sur votre compte via nos méthodes de paiement sécurisées (Crypto, Mobile Money, etc.). Votre demande est enregistrée et un administrateur la valide après vérification, créditant ainsi votre solde.",
    },
    {
      number: "03",
      title: "Création du Contrat",
      description: "Une fois votre solde crédité, vous pouvez créer un contrat d'investissement. Le montant de votre solde est investi dans un contrat à durée déterminée avec un taux de profit mensuel fixe.",
    },
    {
      number: "04",
      title: "Distribution Automatique des Profits",
      description: "Chaque mois, à la date anniversaire de votre contrat, notre système calcule et verse automatiquement vos profits sur votre solde de profits. Vous pouvez suivre cette croissance en temps réel depuis votre tableau de bord.",
    },
    {
      number: "05",
      title: "Retrait des Bénéfices",
      description: "Votre solde de profits est disponible pour un retrait à tout moment. Faites une demande de retrait, et un administrateur la traitera après validation pour vous envoyer vos fonds.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Comment Ça Marche ?
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Découvrez le fonctionnement de Nguma en 5 étapes simples, de votre inscription à la réception de vos profits.
          </p>
        </div>

        <div className="relative">
          {/* The connecting line */}
          <div className="hidden md:block absolute top-8 left-8 w-px h-full bg-border/50" aria-hidden="true"></div>

          <div className="space-y-16">
            {steps.map((step, index) => (
              <div key={index} className="relative flex items-start">
                <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-gradient-card border border-border/50 rounded-full text-primary font-bold text-2xl">
                  {step.number}
                </div>
                <div className="ml-8">
                  <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-lg">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-24">
          <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
            Commencer maintenant <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HowItWorksPage;
