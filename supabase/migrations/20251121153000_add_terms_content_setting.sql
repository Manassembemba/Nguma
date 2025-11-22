-- Add terms_content setting
INSERT INTO public.settings (key, value, description, type)
VALUES (
  'terms_content', 
  '<section>
    <h3 class="text-lg font-semibold">1. Introduction</h3>
    <p>Bienvenue sur Nguma. En utilisant notre plateforme d''investissement, vous acceptez les présentes conditions générales d''utilisation. Veuillez les lire attentivement avant de créer votre compte.</p>
  </section>

  <section>
    <h3 class="text-lg font-semibold">2. Services Proposés</h3>
    <p>Nguma propose des services d''investissement automatisé permettant aux utilisateurs de placer des capitaux et de recevoir des rendements périodiques selon les termes définis dans chaque contrat d''investissement.</p>
  </section>

  <section>
    <h3 class="text-lg font-semibold">3. Risques et Responsabilités</h3>
    <p>L''investissement comporte des risques. Bien que nous nous efforcions de minimiser ces risques, Nguma ne peut garantir l''absence totale de perte de capital. L''utilisateur reconnaît investir en toute connaissance de cause.</p>
  </section>

  <section>
    <h3 class="text-lg font-semibold">4. Engagements de l''Utilisateur</h3>
    <ul class="list-disc pl-5 space-y-2">
      <li>Fournir des informations exactes lors de l''inscription.</li>
      <li>Ne pas utiliser la plateforme à des fins illégales ou frauduleuses.</li>
      <li>Maintenir la confidentialité de ses identifiants de connexion.</li>
    </ul>
  </section>

  <section>
    <h3 class="text-lg font-semibold">5. Durée et Résiliation</h3>
    <p>Les contrats d''investissement ont une durée déterminée (par défaut 10 mois, sauf mention contraire). Le remboursement anticipé est soumis à des conditions spécifiques et peut entraîner des pénalités.</p>
  </section>

  <section>
    <h3 class="text-lg font-semibold">6. Protection des Données</h3>
    <p>Vos données personnelles sont traitées conformément à notre politique de confidentialité et aux lois en vigueur sur la protection des données.</p>
  </section>

  <section>
    <h3 class="text-lg font-semibold">7. Modifications</h3>
    <p>Nguma se réserve le droit de modifier ces conditions à tout moment. Les utilisateurs seront notifiés de tout changement majeur.</p>
  </section>', 
  'Contenu des Conditions Générales d''Utilisation (HTML autorisé).', 
  'textarea'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  updated_at = now();
