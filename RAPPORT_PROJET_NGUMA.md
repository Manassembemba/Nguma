### **Document d'Analyse et Feuille de Route – Projet Nguma**

Ce document a pour but de synthétiser l'état actuel de l'application Nguma et de définir les prochaines étapes de développement.

### **Partie 1 : État Actuel du Projet (Où nous sommes)**

#### **1.1. Mission et Concept Central**

Nguma est une plateforme de gestion d'investissements permettant à des utilisateurs de placer des fonds dans des contrats, de suivre leurs profits de manière transparente et de gérer leurs transactions. Le système est contrôlé par des administrateurs via un tableau de bord dédié, garantissant la sécurité et la supervision des opérations financières.

#### **1.2. Architecture Technique**

*   **Frontend :** L'application est construite avec **React** et **TypeScript**, en utilisant **Vite** comme outil de build. L'interface est conçue avec **shadcn-ui** et **Tailwind CSS**, offrant un design moderne et réactif.
*   **Backend & Base de Données :** Le projet repose entièrement sur **Supabase**, qui fournit la base de données PostgreSQL, le système d'authentification (Auth), la gestion des accès (RLS), et l'environnement pour les fonctions serveur (Edge Functions).
*   **Logique Métier :** Une grande partie de la logique métier critique (création de contrat, distribution des profits, approbation des transactions) est encapsulée dans des **fonctions PostgreSQL (RPC)**. C'est une approche robuste qui garantit la sécurité et l'atomicité des opérations financières.

#### **1.3. Analyse des Fonctionnalités Implémentées**

*   **Espace Investisseur :**
    *   **Tableau de Bord :** Affiche une vue d'ensemble claire des finances de l'utilisateur (**Montant Déposé**, Montant investi, Profits disponibles) et la liste de ses contrats actifs. Le graphique de performance visualise les profits mensuels générés **uniquement par les contrats actifs**, sur une période de 10 mois.
    *   **Création de Contrat :** L'utilisateur peut créer un nouveau contrat en investissant la totalité de son solde disponible. La durée est un paramètre global géré par l'admin.
    *   **Historique des Transactions :** Une page complète et performante avec recherche, filtrage par type, et **pagination** pour consulter tout l'historique.
    *   **Système de Dépôt/Retrait :** Le système de dépôt est actuellement une **simulation**. L'utilisateur déclare son intention de déposer, ce qui crée une transaction en attente que l'admin doit valider après une vérification manuelle (hors-plateforme). Le système de retrait est également manuel.

*   **Espace Administration :**
    *   **Tableau de Bord Global :** Fournit des statistiques sur l'ensemble de la plateforme (nombre d'investisseurs, fonds gérés, profits totaux, transactions en attente).
    *   **Gestion des Transactions :** Interfaces dédiées pour lister les dépôts et retraits en attente, et pour les **approuver** ou les **rejeter**.
    *   **Gestion des Utilisateurs :** Une liste paginée et consultable de tous les investisseurs avec leurs informations clés (incluant les nouveaux champs de profil).
    *   **Gestion des Paramètres :** Une interface pour modifier les variables globales de l'application, comme le taux de profit et la durée des contrats.

*   **Systèmes Automatisés :**
    *   **Distribution des Profits :** Un système intelligent basé sur un **Cron Job quotidien** qui distribue les profits selon un **modèle d'anniversaire** propre à chaque contrat, garantissant l'équité et la précision des paiements.
    *   **Système de Notifications :** Polling-based notifications avec alertes visuelles et **sonores**.

*   **Système de Profil Client Détaillé et Obligatoire :**
    *   **Nouvelle Structure :** La table `profiles` a été mise à jour avec des champs détaillés : `first_name`, `last_name`, `post_nom`, `birth_date`, `address`, `phone`, `country`.
    *   **Page de Profil :** Une page dédiée (`/profile`) permet aux utilisateurs de consulter et de mettre à jour ces informations.
    *   **"Gardien" de Profil :** Un système (`ProfileCompletionGuard`) force les utilisateurs à compléter tous les champs obligatoires de leur profil (prénom, nom, post-nom, téléphone, pays, adresse, date de naissance) avant d'accéder aux autres fonctionnalités de l'application. Un `AlertDialog` s'affiche sur la page de profil pour inviter l'utilisateur à compléter ses informations.
    *   **Formulaire d'Inscription :** Le formulaire d'inscription a été mis à jour pour collecter `first_name`, `last_name`, et `post_nom`.
    *   **Menu Utilisateur :** Un menu déroulant dans l'en-tête (`UserNav`) permet d'accéder au profil et à la déconnexion.

*   **Page d'Accueil (Landing Page) :**
    *   Contient une section FAQ.
    *   Le bouton "En savoir plus" redirige vers la page "Comment Ça Marche".
    *   Les animations 3D ont été retirées pour des raisons de performance.

---

### **Partie 2 : Feuille de Route (Ce que nous allons implémenter)**

Voici une proposition de feuille de route pour les futures évolutions du projet.

#### **2.1. Priorité Haute : Finaliser les Flux Financiers**

*   **Intégration d'une Passerelle de Paiement Semi-Automatique :**
    *   **Objectif :** Remplacer le système de dépôt simulé par une intégration réelle pour automatiser la création des transactions en attente.
    *   **Contexte :** L'intégration de Binance Pay a été tentée mais bloquée par la politique de restriction d'IP de Binance pour les clés API avec permissions d'écriture.
    *   **Action Requise :**
        1.  **Option A (Proxy) :** Explorer l'utilisation d'un service proxy tiers pour obtenir une adresse IP statique pour les Edge Functions, puis mettre cette IP sur liste blanche chez Binance. (Potentiellement coûteux et complexe).
        2.  **Option B (Autre Passerelle) :** Choisir un autre fournisseur de paiement fonctionnel en RDC (ex: **FlashPay**, **CinetPay**) qui est plus flexible avec les adresses IP dynamiques ou qui ne requiert pas de liste blanche IP stricte.
    *   **Implémentation :** Développer les Edge Functions (création de la demande de paiement) et le webhook (réception de la confirmation de paiement) nécessaires pour le fournisseur choisi.

#### **2.2. Fonctionnalités Majeures à Moyen Terme**

*   **Génération de Contrats en PDF :**
    *   **Objectif :** Permettre aux utilisateurs de télécharger une version PDF de leur contrat d'investissement lors de sa création.
    *   **Implémentation :** Utiliser une Edge Function avec une librairie comme `pdf-lib` ou un service externe pour générer le PDF à partir d'un modèle et des données du contrat. Le fichier serait ensuite stocké dans Supabase Storage.

*   **Notifications par E-mail :**
    *   **Objectif :** Envoyer un e-mail à l'utilisateur pour les notifications critiques (dépôt approuvé, profit reçu, etc.) afin qu'il soit informé même en dehors de l'application.
    *   **Action Requise :** Choisir un service d'envoi d'e-mails (ex: **Resend**) et obtenir une clé API.
    *   **Implémentation :** Créer une Edge Function qui se déclenche à chaque nouvelle notification pour envoyer l'e-mail correspondant.

#### **2.3. Évolutions Futures (Vision à Long Terme)**

*   **Introduction du Concept de "Projets" :** Faire évoluer le modèle pour permettre aux administrateurs de définir des projets d'investissement spécifiques (avec des taux/durées potentiellement différents) dans lesquels les utilisateurs peuvent choisir d'investir.
*   **Rapports Mensuels Automatisés :** Générer et envoyer automatiquement par e-mail un relevé de compte mensuel en PDF à chaque investisseur.
*   **Internationalisation (i18n) :** Traduire l'application en plusieurs langues (ex: Anglais) pour élargir l'audience.