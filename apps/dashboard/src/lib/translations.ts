export type Language = 'en' | 'de' | 'fr' | 'it' | 'gsw';

export const translations = {
  en: {
    hero: {
      badge: 'v1.0 Public Beta',
      titleLine1: 'Switzerland',
      titleLine2: 'hosting platform',
      subtitle: 'All services and databases are hosted in Switzerland.',
      description:
        'Helvetia Cloud is the modern Platform-as-a-Service for developers who want the power of Kubernetes with the simplicity of Heroku.',
      ctaPrimary: 'Get Started',
      ctaSecondary: 'View Source',
    },
    features: {
      zeroDowntime: {
        title: 'Zero Downtime',
        desc: 'Deploy updates without dropping a single active connection.',
      },
      gitIntegrated: {
        title: 'Git Integrated',
        desc: 'Push to your branch and watch it deploy automatically.',
      },
      secure: {
        title: 'Secure by Design',
        desc: 'Isolated build environments and strict resource limits.',
      },
      global: {
        title: 'Swiss Quality',
        desc: 'Hosted 100% in Switzerland for maximum privacy and reliability.',
      },
      resource: {
        title: 'Resource Control',
        desc: 'Fine-grained control over CPU and memory allocation.',
      },
      container: {
        title: 'Container Native',
        desc: 'Built on top of Docker for maximum compatibility.',
      },
    },
    ctaSection: {
      title: 'Ready to deploy?',
      subtitle: 'Join thousands of developers building on Helvetia Cloud.',
      button: 'Start Deploys Now',
    },
    footer: {
      rights: '© {year} Helvetia Cloud. Open source under MIT License.',
    },
    cookie: {
      title: 'DSGVO / GDPR Compliance',
      text: 'We use cookies to ensure you get the best experience on our website. This includes compliance with DSGVO/GDPR.',
      accept: 'Accept',
    },
    nav: {
      login: 'Login',
      dashboard: 'Dashboard',
      deployments: 'Deployments',
      newService: 'New Service',
      logout: 'Logout',
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Manage your deployments and services',
      stats: {
        total: 'Total Services',
        active: 'Active',
        failed: 'Failed',
      },
      search: {
        placeholder: 'Search services...',
        noResults: 'No services found',
        tryAgain: 'Try adjusting your search query.',
        getStarted: 'Get started by deploying your first service.',
      },
      actions: {
        redeploy: 'Redeploy',
        restart: 'Restart',
        logs: 'Logs',
        visit: 'Visit',
        edit: 'Edit',
        delete: 'Delete',
        cancel: 'Cancel',
        save: 'Save Changes',
      },
      labels: {
        cpu: 'CPU',
        ram: 'RAM',
        serviceName: 'Service Name',
        repoUrl: 'Repository URL',
        serviceType: 'Service Type',
      },
      modals: {
        editTitle: 'Edit Service',
        logsTitle: 'Build Logs',
        streaming: 'Streaming logs...',
        ended: 'Logs ended.',
      },
    },
  },
  de: {
    hero: {
      badge: 'v1.0 Public Beta',
      titleLine1: 'Schweizer',
      titleLine2: 'Hosting-Plattform',
      subtitle: 'Alle Dienste und Datenbanken werden in der Schweiz gehostet.',
      description:
        'Helvetia Cloud ist die moderne Platform-as-a-Service für Entwickler, die die Leistung von Kubernetes mit der Einfachheit von Heroku wollen.',
      ctaPrimary: 'Loslegen',
      ctaSecondary: 'Quellcode anzeigen',
    },
    features: {
      zeroDowntime: {
        title: 'Keine Ausfallzeit',
        desc: 'Updates bereitstellen, ohne aktive Verbindungen zu unterbrechen.',
      },
      gitIntegrated: {
        title: 'Git Integriert',
        desc: 'Pushen Sie auf Ihren Branch und sehen Sie zu, wie Ihre Anwendung automatisch bereitgestellt wird.',
      },
      secure: {
        title: 'Sicher im Design',
        desc: 'Isolierte Build-Umgebungen und strikte Ressourcenlimits.',
      },
      global: {
        title: 'Schweizer Qualität',
        desc: '100% in der Schweiz gehostet für maximale Privatsphäre und Zuverlässigkeit.',
      },
      resource: {
        title: 'Ressourcenkontrolle',
        desc: 'Feingranulare Kontrolle über CPU- und Speicherzuweisung.',
      },
      container: {
        title: 'Container Native',
        desc: 'Auf Docker aufgebaut für maximale Kompatibilität.',
      },
    },
    ctaSection: {
      title: 'Bereit zum Bereitstellen?',
      subtitle: 'Schließen Sie sich tausenden von Entwicklern an.',
      button: 'Jetzt bereitstellen',
    },
    footer: {
      rights: '© {year} Helvetia Cloud. Open Source unter MIT Lizenz.',
    },
    cookie: {
      title: 'DSGVO / GDPR Konformität',
      text: 'Wir verwenden Cookies, um das beste Erlebnis auf unserer Website zu gewährleisten (DSGVO-konform).',
      accept: 'Akzeptieren',
    },
    nav: {
      login: 'Anmelden',
      dashboard: 'Dashboard',
      deployments: 'Deployments',
      newService: 'Neuer Service',
      logout: 'Abmelden',
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Verwalten Sie Ihre Deployments und Dienste',
      stats: {
        total: 'Dienste Gesamt',
        active: 'Aktiv',
        failed: 'Fehlgeschlagen',
      },
      search: {
        placeholder: 'Dienste suchen...',
        noResults: 'Keine Dienste gefunden',
        tryAgain: 'Versuchen Sie Ihre Suchanfrage anzupassen.',
        getStarted: 'Starten Sie mit Ihrem ersten Service.',
      },
      actions: {
        redeploy: 'Redeploy',
        restart: 'Neustart',
        logs: 'Logs',
        visit: 'Öffnen',
        edit: 'Bearbeiten',
        delete: 'Löschen',
        cancel: 'Abbrechen',
        save: 'Speichern',
      },
      labels: {
        cpu: 'CPU',
        ram: 'RAM',
        serviceName: 'Service Name',
        repoUrl: 'Repository URL',
        serviceType: 'Service Typ',
      },
      modals: {
        editTitle: 'Service bearbeiten',
        logsTitle: 'Build Logs',
        streaming: 'Logs werden gestreamt...',
        ended: 'Logs beendet.',
      },
    },
  },
  fr: {
    hero: {
      badge: 'v1.0 Bêta Publique',
      titleLine1: 'Plateforme',
      titleLine2: "d'hébergement suisse",
      subtitle: 'Tous les services et bases de données sont hébergés en Suisse.',
      description:
        "Helvetia Cloud est la plateforme as-a-service moderne pour les développeurs qui veulent la puissance de Kubernetes avec la simplicité d'Heroku.",
      ctaPrimary: 'Commencer',
      ctaSecondary: 'Voir la source',
    },
    features: {
      zeroDowntime: {
        title: 'Zéro interruption',
        desc: 'Déployez des mises à jour sans perdre une seule connexion active.',
      },
      gitIntegrated: {
        title: 'Git Intégré',
        desc: 'Poussez vers votre branche et il se déploie automatiquement.',
      },
      secure: {
        title: 'Conception sécurisée',
        desc: 'Environnements de build isolés et limites de ressources strictes.',
      },
      global: {
        title: 'Qualité Suisse',
        desc: 'Hébergé à 100% en Suisse pour une confidentialité et une fiabilité maximales.',
      },
      resource: {
        title: 'Contrôle des ressources',
        desc: "Contrôle précis de l'allocation CPU et mémoire.",
      },
      container: {
        title: 'Natif Conteneur',
        desc: 'Construit sur Docker pour une compatibilité maximale.',
      },
    },
    ctaSection: {
      title: 'Prêt à déployer ?',
      subtitle: 'Rejoignez des milliers de développeurs.',
      button: 'Déployer maintenant',
    },
    footer: {
      rights: '© {year} Helvetia Cloud. Open source sous licence MIT.',
    },
    cookie: {
      title: 'Conformité RGPD / DSGVO',
      text: 'Nous utilisons des cookies pour garantir la meilleure expérience (conforme RGPD).',
      accept: 'Accepter',
    },
    nav: {
      login: 'Connexion',
      dashboard: 'Tableau de bord',
      deployments: 'Déploiements',
      newService: 'Nouveau Service',
      logout: 'Déconnexion',
    },
    dashboard: {
      title: 'Tableau de bord',
      subtitle: 'Gérez vos déploiements et services',
      stats: {
        total: 'Total Services',
        active: 'Actifs',
        failed: 'Échoués',
      },
      search: {
        placeholder: 'Rechercher...',
        noResults: 'Aucun service trouvé',
        tryAgain: "Essayez d'ajuster votre recherche.",
        getStarted: 'Commencez par déployer votre premier service.',
      },
      actions: {
        redeploy: 'Redéployer',
        restart: 'Redémarrer',
        logs: 'Logs',
        visit: 'Visiter',
        edit: 'Modifier',
        delete: 'Supprimer',
        cancel: 'Annuler',
        save: 'Enregistrer',
      },
      labels: {
        cpu: 'CPU',
        ram: 'RAM',
        serviceName: 'Nom du service',
        repoUrl: 'URL du dépôt',
        serviceType: 'Type de service',
      },
      modals: {
        editTitle: 'Modifier le service',
        logsTitle: 'Journaux de build',
        streaming: 'Streaming des logs...',
        ended: 'Fin des logs.',
      },
    },
  },
  it: {
    hero: {
      badge: 'v1.0 Beta Pubblica',
      titleLine1: 'Piattaforma',
      titleLine2: 'di hosting svizzera',
      subtitle: 'Tutti i servizi e i database sono ospitati in Svizzera.',
      description:
        'Helvetia Cloud è la moderna Platform-as-a-Service per sviluppatori che vogliono la potenza di Kubernetes con la semplicità di Heroku.',
      ctaPrimary: 'Inizia',
      ctaSecondary: 'Vedi sorgente',
    },
    features: {
      zeroDowntime: {
        title: 'Zero Downtime',
        desc: 'Distribuisci aggiornamenti senza interrompere le connessioni attive.',
      },
      gitIntegrated: {
        title: 'Git Integrato',
        desc: 'Pusha sul tuo branch e guarda il deploy automatico.',
      },
      secure: {
        title: 'Sicuro per Design',
        desc: 'Ambienti di build isolati e limiti rigorosi delle risorse.',
      },
      global: {
        title: 'Qualità Svizzera',
        desc: 'Ospitato al 100% in Svizzera per la massima privacy e affidabilità.',
      },
      resource: {
        title: 'Controllo Risorse',
        desc: 'Controllo granulare su CPU e allocazione della memoria.',
      },
      container: {
        title: 'Nativo Container',
        desc: 'Costruito su Docker per la massima compatibilità.',
      },
    },
    ctaSection: {
      title: 'Pronto a distribuire?',
      subtitle: 'Unisciti a migliaia di sviluppatori.',
      button: 'Distribuisci ora',
    },
    footer: {
      rights: '© {year} Helvetia Cloud. Open source sotto licenza MIT.',
    },
    cookie: {
      title: 'Conformità GDPR / DSGVO',
      text: 'Utilizziamo i cookie per garantire la migliore esperienza (conforme DSGVO).',
      accept: 'Accetta',
    },
    nav: {
      login: 'Accedi',
      dashboard: 'Dashboard',
      deployments: 'Deployment',
      newService: 'Nuovo Servizio',
      logout: 'Esci',
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Gestisci i tuoi deployment e servizi',
      stats: {
        total: 'Servizi Totali',
        active: 'Attivi',
        failed: 'Falliti',
      },
      search: {
        placeholder: 'Cerca servizi...',
        noResults: 'Nessun servizio trovato',
        tryAgain: 'Prova a modificare la tua ricerca.',
        getStarted: 'Inizia distribuendo il tuo primo servizio.',
      },
      actions: {
        redeploy: 'Redeploy',
        restart: 'Riavvia',
        logs: 'Logs',
        visit: 'Visita',
        edit: 'Modifica',
        delete: 'Elimina',
        cancel: 'Annulla',
        save: 'Salva',
      },
      labels: {
        cpu: 'CPU',
        ram: 'RAM',
        serviceName: 'Nome Servizio',
        repoUrl: 'URL Repository',
        serviceType: 'Tipo Servizio',
      },
      modals: {
        editTitle: 'Modifica Servizio',
        logsTitle: 'Log di Build',
        streaming: 'Streaming logs...',
        ended: 'Logs terminati.',
      },
    },
  },
  gsw: {
    hero: {
      badge: 'v1.0 Beta',
      titleLine1: 'Schwiizer',
      titleLine2: 'Hosting-Plattform',
      subtitle: 'Alli Dienscht und Datebanke sind i de Schwiiz ghostet.',
      description:
        "Helvetia Cloud isch die moderni Platform-as-a-Service für Entwickler, wo d'Leichtig vo Kubernetes mit de Eifachheit vo Heroku wänd.",
      ctaPrimary: 'Aafange',
      ctaSecondary: 'Code aaluege',
    },
    features: {
      zeroDowntime: {
        title: 'Kei Unterbruch',
        desc: "Updates iispile ohni Verbindige z'verlüüre.",
      },
      gitIntegrated: {
        title: 'Git Integriert',
        desc: "Eifach pushe und s'Deployment passiert automatisch.",
      },
      secure: {
        title: 'Sicher und Suber',
        desc: 'Isolierti Umgäbige und strikti Ressource-Limite.',
      },
      global: {
        title: 'Schwiizer Qualität',
        desc: '100% i de Schwiiz ghostet für maximali Privatsphäre.',
      },
      resource: { title: 'Ressource Kontrolle', desc: 'Gnaui Kontrolle über CPU und Spicher.' },
      container: {
        title: 'Container Native',
        desc: 'Basiert uf Docker für beschti Kompatibilität.',
      },
    },
    ctaSection: {
      title: 'Parat zum Loslege?',
      subtitle: 'Mach mit bi tusige vo Entwickler.',
      button: 'Jetzt deploye',
    },
    footer: {
      rights: '© {year} Helvetia Cloud. Open Source under MIT Lizenz.',
    },
    cookie: {
      title: 'DSGVO / GDPR Konformität',
      text: "Mir bruuche Cookies für s'bescht Erlebnis (DSGVO konform).",
      accept: 'Akzeptiere',
    },
    nav: {
      login: 'Aamälde',
      dashboard: 'Dashboard',
      deployments: 'Deployments',
      newService: 'Neue Service',
      logout: 'Abmälde',
    },
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Verwalt dini Deployments und Dienscht',
      stats: {
        total: 'Dienscht Gesamt',
        active: 'Aktiv',
        failed: 'Fählerhaft',
      },
      search: {
        placeholder: 'Dienscht sueche...',
        noResults: 'Kei Dienscht gfunde',
        tryAgain: 'Probier dini Suech apasse.',
        getStarted: 'Fang aa mit dim erschte Service.',
      },
      actions: {
        redeploy: 'Redeploy',
        restart: 'Neustarte',
        logs: 'Logs',
        visit: 'Bsueche',
        edit: 'Bearbeite',
        delete: 'Lösche',
        cancel: 'Abbräche',
        save: 'Spichere',
      },
      labels: {
        cpu: 'CPU',
        ram: 'RAM',
        serviceName: 'Service Name',
        repoUrl: 'Repository URL',
        serviceType: 'Service Typ',
      },
      modals: {
        editTitle: 'Service bearbeite',
        logsTitle: 'Build Logs',
        streaming: 'Logs werded glade...',
        ended: 'Logs fertig.',
      },
    },
  },
};
