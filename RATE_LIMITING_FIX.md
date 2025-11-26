# Correction de l'erreur Rate Limiting

## 🔍 Problème identifié

L'erreur TypeScript que vous rencontriez :
```
Argument of type '"check_rate_limit"' is not assignable to parameter of type '"get_pending_deposits_with_profiles" | "approve_deposit" | ...
```

était causée par le fait que les fonctions RPC `check_rate_limit` et `admin_unblock_rate_limit` n'existaient pas dans votre base de données Supabase.

## ✅ Solutions appliquées

### 1. Mise à jour du fichier types.ts (Temporaire)
J'ai ajouté manuellement les types TypeScript pour ces deux fonctions dans `src/integrations/supabase/types.ts`. Cela permet au code de compiler sans erreur.

### 2. Création de la migration SQL
J'ai créé le fichier `supabase/migrations/20250126_create_rate_limit_functions.sql` qui contient :

- **`check_rate_limit()`** : Fonction qui vérifie et applique les limites de taux
  - Nettoie automatiquement les anciennes entrées expirées
  - Crée ou met à jour les compteurs de tentatives
  - Retourne un objet JSON avec :
    - `allowed` : si l'action est autorisée
    - `remaining` : nombre de tentatives restantes
    - `reset_at` : quand le compteur sera réinitialisé
    - `blocked` : si l'utilisateur est bloqué

- **`admin_unblock_rate_limit()`** : Fonction admin pour débloquer un utilisateur
  - Vérifie que l'utilisateur est bien un administrateur
  - Supprime les entrées de rate limit pour l'identifiant spécifié

## 📋 Prochaines étapes

Pour appliquer cette migration à votre base de données Supabase :

### Option A : Via le Dashboard Supabase (Recommandé)
1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Allez dans **SQL Editor**
3. Copiez le contenu du fichier `supabase/migrations/20250126_create_rate_limit_functions.sql`
4. Collez-le dans l'éditeur SQL
5. Cliquez sur **Run** pour exécuter la migration

### Option B : Via la CLI Supabase
```bash
# Si vous avez la CLI Supabase installée
supabase db push
```

### Option C : Régénérer les types (Après avoir appliqué la migration)
Une fois que les fonctions sont créées en base de données :
```bash
npm run generate-types
# ou
supabase gen types typescript --project-id <YOUR_PROJECT_ID> > src/integrations/supabase/types.ts
```

## 🧪 Test de la solution

Après avoir appliqué la migration, vous pouvez tester le service :

```typescript
import { checkRateLimit } from '@/services/rateLimitService';

// Tester la limite de taux pour une connexion
const result = await checkRateLimit('user@example.com', 'login');
console.log('Autorisé:', result.allowed);
console.log('Restant:', result.remaining);
console.log('Réinitialisation:', result.reset_at);
```

## 📝 Notes importantes

- Les fonctions sont créées avec `SECURITY DEFINER`, ce qui signifie qu'elles s'exécutent avec les privilèges du propriétaire de la fonction
- La fonction `admin_unblock_rate_limit` vérifie que seuls les administrateurs peuvent l'utiliser
- Les anciennes entrées de rate limiting sont automatiquement nettoyées lors de chaque appel
- La fonction gère à la fois les identifiants UUID (user_id) et les identifiants textuels (email, IP)

## ⚠️ Important pour la production

Le fichier `types.ts` que j'ai modifié est normalement **généré automatiquement** par Supabase. Après avoir appliqué la migration en base de données, je vous recommande de régénérer ce fichier pour qu'il reflète exactement votre schéma de base de données.
