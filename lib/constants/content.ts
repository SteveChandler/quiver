import {
  Heart,
  Shield,
  Users,
  Target,
  Waves,
  Globe,
  Lock,
  Eye,
  UserCheck,
  Database,
  Trash2,
  Mail,
  Settings,
} from "lucide-react";

export const ABOUT_CONTENT = {
  hero: {
    title: "About Quiver",
    subtitle: "The story behind the surf community platform",
    description:
      "Born from a passion for surfing and a belief that the best sessions happen with friends, Quiver connects surfers worldwide to share the stoke.",
  },
  mission: {
    title: "Our Mission",
    subtitle: "Connecting surfers, one session at a time",
    description:
      "We believe surfing is better when shared. Quiver exists to help surfers find their crew, discover epic spots, and build lasting connections through our shared love of the ocean.",
    values: [
      {
        icon: Heart,
        title: "Community First",
        description:
          "Every feature we build strengthens the bonds between surfers and celebrates our shared passion.",
      },
      {
        icon: Shield,
        title: "Authentic Connections",
        description:
          "We foster genuine relationships built on trust, respect, and the mutual love of surfing.",
      },
      {
        icon: Waves,
        title: "Ocean Respect",
        description:
          "We promote sustainable surfing practices and encourage respect for our marine environment.",
      },
    ],
  },
  story: {
    title: "Our Story",
    content: [
      "Quiver was born from countless solo surf sessions where we wished we had someone to share the stoke with. We noticed that surfers everywhere faced the same challenge - finding like-minded people to surf with and share experiences.",
      "What started as a simple idea to connect local surfers has evolved into a comprehensive platform that helps surfers plan sessions, track their progress, discover new spots, and most importantly, build lasting friendships.",
      "Today, Quiver serves surfers across the globe, from beginners catching their first waves to seasoned pros sharing their knowledge. We're building more than just an app - we're cultivating a community that celebrates the pure joy of surfing.",
    ],
  },
  team: {
    title: "Built by Surfers, for Surfers",
    description:
      "Our team understands the surf community because we are the surf community. Every line of code is written with deep respect for surf culture and the connections that make our sport special.",
  },
  future: {
    title: "The Future of Surf Community",
    description:
      "We're just getting started. Our vision is to become the essential platform that every surfer uses to connect with their community, whether they're at their home break or exploring waves on the other side of the world.",
    goals: [
      "Connect 1 million surfers worldwide",
      "Support local surf communities globally",
      "Promote ocean conservation and sustainability",
      "Foster the next generation of surfers",
    ],
  },
} as const;

export const PRIVACY_CONTENT = {
  hero: {
    title: "Privacy Policy",
    subtitle: "How we protect and handle your data",
    lastUpdated: "January 15, 2025",
    effectiveDate:
      "This policy is effective as of January 15, 2025. We will notify you of any material changes by email or through our app.",
  },
  overview: {
    title: "Welcome to Quiver's Privacy Policy",
    description:
      "Quiver Surf Technologies, Inc. is a corporation registered in Delaware, United States of America, serving surfers primarily in the United States. We respect your privacy and are committed to protecting your personal data. This Privacy Policy will inform you as to how we look after your personal data in connection with your access to or use of our websites, apps, products and services (including without limitation Quiver's domains and subdomains, session tracking, forecasts, social features, community platform, and surf analytics) (collectively, the 'Services'). It also tells you about your privacy rights under applicable US privacy laws including the California Consumer Privacy Act (CCPA).",
  },
  importantInfo: {
    title: "Important Information and Who We Are",
    purpose:
      "This Privacy Policy aims to give you information on how we collect and process your personal data under applicable privacy and data security laws through your use of our Services.",
    childrenPolicy:
      "Our Services are not intended for use by children, meaning individuals under the age of 16, and we do not knowingly collect data relating to children.",
    contact:
      "If you have any questions about this Privacy Policy or our privacy practices, or would like to contact our Data Protection Officer, you can do so by email at privacy@quiversurf.com or by mail at: Quiver Surf Technologies, 2261 Market Street STE 10852, San Francisco, CA 94114, Attn: Legal",
    changes:
      "We keep our privacy policy under regular review and make changes from time to time and will take appropriate measures to inform you as required by applicable data protection laws. Your continued use of the Services after any updates to this Privacy Policy take effect will constitute acknowledgement and acceptance of those changes.",
    thirdPartyLinks:
      "Our websites and apps may include links to third-party websites, plug-ins and applications. Clicking on those links or enabling those connections may allow third parties to collect or share data about you and any information collected by them is subject to that third party's own privacy policies.",
  },
  dataCategories: {
    title: "The Data We Collect About You",
    intro:
      "Personal information means any information about an individual from which that person can be identified. We may collect, use, store and transfer different kinds of personal information about you which we have grouped together as follows:",
    categories: [
      {
        name: "Standard Identity Data",
        description:
          "includes name, alias, address (including zip code), email, phone number, marital status, date of birth, and gender.",
        sources: "Directly or indirectly from you, From third parties",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests, Necessary to comply with a legal obligation",
        disclosed:
          "Any person with your credentials, Ad and marketing service providers, Data analytics service providers, User support service providers, Governmental authorities",
      },
      {
        name: "Profile Data",
        description:
          "includes username, password, account type, general location, profile photo, marketing preferences, interests, surf experience, lifestyle information, support communications, feedback, and reviews.",
        sources: "Directly or indirectly from you, From third parties",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests, Necessary to comply with a legal obligation",
        disclosed:
          "Any person with your credentials, Ad and marketing service providers, Data analytics service providers, User support service providers, Governmental authorities",
      },
      {
        name: "Transaction Data",
        description:
          "includes details of products and services you have purchased from us. We use Stripe, Inc. as our Payment Processor for financial information collection and storage.",
        sources: "Directly or indirectly from you, From third parties",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests, Necessary to comply with a legal obligation",
        disclosed:
          "Any person with your credentials, Payment processors, Collections and financial service providers, Governmental authorities",
      },
      {
        name: "Technical Data",
        description:
          "includes internet protocol (IP) address, device ID, login data, browser type and version, time zone setting and location, browsing patterns, operating system and platform.",
        sources: "Directly or indirectly from you, From third parties",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests, Necessary to comply with a legal obligation",
        disclosed:
          "Any person with your credentials, Diagnostic service providers, Data analytics service providers, Governmental authorities",
      },
      {
        name: "Usage Data",
        description:
          "includes information about how you use our Services, length of time spent, frequency of use, photographs, videos, comments, surf session data, and metadata.",
        sources: "Directly or indirectly from you, From third parties",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests, Necessary to comply with a legal obligation",
        disclosed:
          "Any person with your credentials, Ad and marketing service providers",
      },
      {
        name: "Surf Session Data",
        description:
          "includes session locations, conditions, photos, notes, equipment used, session duration, and other surf-related information you choose to log and share.",
        sources: "Directly or indirectly from you",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests",
        disclosed:
          "Any person with your credentials, Community members (based on privacy settings)",
      },
      {
        name: "Sensitive Personal Data",
        description:
          "includes precise geolocation when tracking surf sessions and identification documentation for identity verification. This data will only be collected where necessary and with your consent.",
        sources: "Directly or indirectly from you, From third parties",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests, Consent",
        disclosed:
          "Any person with your credentials, Connected device and account providers",
      },
    ],
  },
  accessibility: {
    title: "Accessibility Notice",
    description:
      "We are committed to ensuring digital accessibility for all users. If you experience any difficulty accessing this privacy policy or need it in an alternative format, please contact us at privacy@quiversurf.com or call us at +1 (555) 123-SURF. We will work with you to provide the information in a format that meets your needs.",
  },
  sections: [
    {
      id: "data-collection-methods",
      icon: Database,
      title: "How Is Your Personal Data Collected?",
      content: [
        {
          subtitle: "Direct Interactions",
          details:
            "You may give us your Identity Data, Profile Data, Transaction Data by filling in forms or corresponding with us through the Services, by post, phone, email or otherwise. This includes when you create an account, subscribe to services, request marketing, enter competitions, or contact us.",
        },
        {
          subtitle: "Automated Technologies",
          details:
            "As you interact with our Services, we automatically collect Technical and Usage Data about your equipment, browsing actions and patterns through cookies, web beacons, and similar technologies.",
        },
        {
          subtitle: "Third Parties or Public Sources",
          details:
            "We receive personal data from analytics providers (Google), advertising networks, payment processors (Stripe), social media networks (Facebook, Google), and data brokers or aggregators.",
        },
        {
          subtitle: "Connected Devices/Accounts",
          details:
            "With your consent, we collect information from third-party devices and apps you connect to Quiver (such as fitness trackers or smartwatches) to enhance your surf session tracking.",
        },
      ],
    },
    {
      id: "how-we-use-data",
      icon: Target,
      title: "How We Use Your Personal Data",
      content: [
        {
          subtitle: "Performance of a Contract",
          details:
            "Where we need to perform the contract to which you are a party or to take steps at your request before entering into such a contract. This includes providing core surf community services, session tracking, and account management.",
        },
        {
          subtitle: "Legitimate Interest",
          details:
            "Where it is necessary for our legitimate interests in conducting and managing our business and your interests and fundamental rights do not override those interests. This includes improving our services, analytics, and fraud prevention.",
        },
        {
          subtitle: "Compliance with Legal Obligation",
          details:
            "Where we need to comply with a legal obligation that we are subject to, such as responding to lawful requests from authorities or meeting regulatory requirements.",
        },
        {
          subtitle: "Marketing Communications",
          details:
            "We may use your data for marketing if you have provided express consent, requested information from us, or created an account with us and have not opted out. You can opt out anytime by contacting privacy@quiversurf.com.",
        },
      ],
    },
    {
      id: "data-disclosures",
      icon: UserCheck,
      title: "Disclosures of Your Personal Data",
      content: [
        {
          subtitle: "Internal Third Parties",
          details:
            "Other companies in the Quiver group acting as controllers or processors who provide IT and system administration services. We may share your data with employees, contractors or agents to operate and improve our services.",
        },
        {
          subtitle: "External Third Parties",
          details:
            "Service providers including vendors, consultants, data analytics providers, ad networks, research companies, marketing services, fraud prevention, financial services, and professional advisers (lawyers, bankers, auditors, insurers).",
        },
        {
          subtitle: "Regulators and Authorities",
          details:
            "Law enforcement, tax and customs authorities, governmental authorities and other authorized persons required by law or deemed necessary for the best interests of Quiver and user safety.",
        },
        {
          subtitle: "Advertising Partners",
          details:
            "Companies that help us provide advertising to you and customize your experience. These partners may use tracking technologies to collect information about you. See our Third Party Ad Servers section for opt-out information.",
        },
        {
          subtitle: "Business Transfers",
          details:
            "Third parties to whom we may choose to sell, transfer or merge parts of our business or assets. If a change happens to our business, the new owners may use your personal data in the same way as set out in this Privacy Policy.",
        },
      ],
    },
    {
      id: "international-transfers",
      icon: Globe,
      title: "International Transfers",
      content: [
        {
          subtitle: "Global Operations",
          details:
            "Quiver operates from various countries around the world, as do our service providers. This means that when you use Quiver, your personal information may be transferred to other countries that have different data protection laws than those where you reside.",
        },
        {
          subtitle: "Transfer Safeguards",
          details:
            "When we transfer personal data outside the UK or EEA, we ensure protection through: (1) Countries with adequate protection levels deemed by the European Commission or UK government; (2) Specific contracts approved by authorities giving personal data the same protection; (3) Organizational and technical safeguards.",
        },
        {
          subtitle: "Service Provider Locations",
          details:
            "Our service providers operate globally: Supabase (EU/US), Google Analytics (global), Vercel (global), and Stripe (global). All transfers comply with applicable data protection laws and this Privacy Policy.",
        },
      ],
    },
    {
      id: "data-security",
      icon: Shield,
      title: "Data Security",
      content: [
        {
          subtitle: "Security Measures",
          details:
            "We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. We limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.",
        },
        {
          subtitle: "Data Breach Procedures",
          details:
            "We have put in place procedures to deal with any suspected personal data breach and will notify you and any applicable regulator of a breach where we are legally required to do so.",
        },
      ],
    },
    {
      id: "data-retention",
      icon: Trash2,
      title: "Data Retention",
      content: [
        {
          subtitle: "Retention Periods",
          details:
            "We will only retain your personal data for as long as reasonably necessary to fulfil the purposes we collected it for, including for the purposes of satisfying any legal, regulatory, tax, accounting or reporting requirements.",
        },
        {
          subtitle: "Account Data",
          details:
            "We retain your Identity Data as long as any account with us remains in force. We may retain your personal data for a longer period in the event of a complaint or if we reasonably believe there is a prospect of litigation.",
        },
        {
          subtitle: "Determining Retention",
          details:
            "To determine the appropriate retention period, we consider the amount, nature and sensitivity of the personal data, the potential risk of harm from unauthorized use or disclosure, the purposes for processing and whether we can achieve those purposes through other means, and applicable legal requirements.",
        },
      ],
    },
    {
      id: "third-party-ad-servers",
      icon: Target,
      title: "Third Party Ad Servers",
      content: [
        {
          subtitle: "Advertising Partners",
          details:
            "Our advertising service vendors and other third parties use tracking technologies to serve you advertisements tailored to interests you have shown by using our Services and other sites. These third parties collect non-personally identifiable data including device specifications, geographic location, IP address, pages visited, and other clickstream data.",
        },
        {
          subtitle: "Tracking Technologies",
          details:
            "The use of tracking technologies by third parties is subject to their own privacy policies, not this Privacy Policy. We have no responsibility or liability in connection therewith. You may opt-out of certain tracking by visiting http://optout.networkadvertising.org, using script-blockers, and modifying tracking options in your browser or device.",
        },
        {
          subtitle: "Advertising Networks",
          details:
            "Quiver has partnered with various advertising networks to manage programmatic advertising. These partners implement tracking technologies on Quiver's properties and their privacy policies govern the collection of your data.",
        },
      ],
    },
    {
      id: "cookie-policy",
      icon: Settings,
      title: "Cookie Policy",
      content: [
        {
          subtitle: "What Are Cookies",
          details:
            "A cookie is a small file of letters and numbers that we store on your browser or the hard drive of your computer if you agree. Cookies contain information that is transferred to your computer's hard drive.",
        },
        {
          subtitle: "Strictly Necessary Cookies",
          details:
            "These are cookies that are required for the operation of our websites and cannot be switched off in our systems. They include cookies that enable you to log into secure areas of our websites.",
        },
        {
          subtitle: "Analytical or Performance Cookies",
          details:
            "These cookies enable us to recognize and count the number of visitors and see how visitors move around our websites. This helps us improve the way our websites work, for example, by ensuring that users find what they are looking for easily.",
        },
        {
          subtitle: "Functionality Cookies",
          details:
            "These cookies allow the website to provide enhanced functionality and personalization. They are used to recognize you when you return to our websites and enable us to personalize our content, greet you by name and remember your preferences.",
        },
        {
          subtitle: "Targeting Cookies",
          details:
            "These cookies record your visit to our websites, the pages you have visited and the links you have followed. We use this information to make our websites and advertising displayed on them more relevant to your interests. We may also share this information with third parties for this purpose.",
        },
        {
          subtitle: "Managing Cookies",
          details:
            "Except for strictly necessary cookies, you can choose which cookies we can set by using our consent management platform. You may also update your browser settings to manage your cookie preferences. However, if you block all cookies you may not be able to access all or parts of our websites.",
        },
      ],
    },
    {
      id: "your-legal-rights",
      icon: Eye,
      title: "Your Legal Rights",
      content: [
        {
          subtitle: "General Rights Information",
          details:
            "If you are a resident of the United States, please refer to the U.S. Residents section below for specific rights under applicable privacy laws including the California Consumer Privacy Act (CCPA).",
        },
        {
          subtitle: "Exercising Your Rights",
          details:
            "To exercise any of your privacy rights (including data export or account deletion requests), please submit a request to us by visiting our Support Center, emailing us at privacy@quiversurf.com, or writing to us at: Quiver Surf Technologies, 2261 Market Street STE 10852, San Francisco, CA 94114, Attn: Privacy Request.",
        },
        {
          subtitle: "Identity Verification",
          details:
            "We may need to request specific information from you to help us confirm your identity and ensure your right to access your personal data. This is a security measure to ensure that personal data is not disclosed to any person who has no right to receive it.",
        },
        {
          subtitle: "Response Time",
          details:
            "We try to respond to all legitimate requests within one month. Occasionally it could take us longer if your request is particularly complex or you have made a number of requests. In this case, we will notify you and keep you updated.",
        },
      ],
    },
  ],
  annexes: {
    usResidents: {
      title: "PRIVACY RIGHTS FOR U.S. RESIDENTS",
      intro:
        "This section is adopted to comply with U.S. comprehensive privacy laws, such as the California Consumer Privacy Act (CCPA) and other applicable state privacy laws. Any terms defined in the applicable privacy laws have the same meaning when used in this section.",
      sections: [
        {
          title: "Sales or Sharing of Personal Information",
          content:
            "We may sell or share your digital activity information with third parties for marketing campaigns and usage statistics. This may constitute a 'sale' or 'share' under applicable privacy laws. You may opt-out by enabling Global Privacy Control (GPC) on your browsers or contacting us at privacy@quiversurf.com.",
        },
        {
          title: "Your Rights and Choices",
          content:
            "You have rights to: (1) Request access to specific information and data portability - contact us to request a comprehensive data export; (2) Request deletion of personal information - submit a deletion request for account and data removal; (3) Request correction of inaccurate personal information; (4) Appeal refusal to take action on requests. To exercise these rights, visit our Support Center, email privacy@quiversurf.com, or write to: Quiver Surf Technologies, CCPA Request, 2261 Market Street STE 10852, San Francisco, CA 94114.",
        },
        {
          title: "Non-Discrimination",
          content:
            "We will not discriminate against you for exercising any of your privacy rights under applicable law.",
        },
        {
          title: "California's 'Shine the Light' Law",
          content:
            "California residents with an established business relationship may request information regarding our disclosure of personal information to third parties for direct marketing purposes during the preceding calendar year.",
        },
      ],
    },

    surfSessions: {
      title: "SURF SESSION TRACKING PRIVACY INFORMATION",
      intro:
        "This section describes how Quiver processes your information when using surf session tracking features.",
      sections: [
        {
          title: "Surf Session Data Collection",
          content:
            "When you track surf sessions, we may collect: GPS location data, session duration, wave count estimates, speed data, photos you choose to upload, equipment information, and other session-related data you provide.",
        },
        {
          title: "How Sessions Are Displayed",
          content:
            "Each tracked surf session will appear in your Quiver account with relevant data such as session time, location, and any photos. Sessions create unique URLs that are publicly available by default so you can share them. Your session data, including name and location, will be accessible through these public links unless you change your privacy settings.",
        },
        {
          title: "Connected Devices",
          content:
            "With your consent, we may collect data from connected devices like fitness trackers or smartwatches to enhance your session tracking experience. Information collected by these third parties is subject to their terms and policies.",
        },
      ],
    },
  },
  contact: {
    title: "Contact Information",
    description:
      "If you have any questions or comments about this privacy policy, your choices and rights regarding data use, or wish to exercise your rights (including data export or account deletion requests), please contact us:",
    methods: [
      {
        type: "Website",
        value: "https://support.quiversurf.com",
      },
      {
        type: "Email",
        value: "privacy@quiversurf.com",
      },
      {
        type: "Postal Address",
        value:
          "Quiver Surf Technologies, 2261 Market Street STE 10852, San Francisco, CA 94114, Attn: Privacy Request",
      },
    ],
  },
} as const;

export const FEATURES_EXTENDED_CONTENT = {
  hero: {
    title: "Everything You Need to Surf with Friends",
    subtitle:
      "Discover all the features that make Quiver the ultimate surf community platform",
    description:
      "From finding surf buddies to tracking epic sessions, Quiver brings surfers together through powerful, easy-to-use features designed by surfers, for surfers.",
  },
  categories: [
    {
      id: "community",
      title: "Community & Social",
      description: "Connect with surfers who share your passion",
      features: [
        {
          title: "Find Local Surf Buddies",
          description:
            "Connect with surfers in your area based on skill level, preferred breaks, and availability. Never surf alone again.",
          benefits: [
            "Safety in numbers",
            "Learn from others",
            "Share the stoke",
            "Build lasting friendships",
          ],
        },
        {
          title: "Activity Feed",
          description:
            "Stay connected with your surf community through a personalized feed of sessions, photos, and updates from fellow surfers.",
          benefits: [
            "See what friends are surfing",
            "Discover new spots",
            "Get inspired",
            "Share your sessions",
          ],
        },
        {
          title: "Follow System",
          description:
            "Follow your favorite surfers and stay updated on their latest sessions and discoveries.",
          benefits: [
            "Curated content",
            "Learn from pros",
            "Build your network",
            "Stay motivated",
          ],
        },
        {
          title: "Session Comments & Likes",
          description:
            "Engage with the community by commenting on sessions, sharing tips, and showing appreciation for epic waves.",
          benefits: [
            "Share knowledge",
            "Build connections",
            "Get feedback",
            "Celebrate together",
          ],
        },
      ],
    },
    {
      id: "session-tracking",
      title: "Session Tracking",
      description: "Log and share your surf journey",
      features: [
        {
          title: "Detailed Session Logging",
          description:
            "Record comprehensive details about every surf session including conditions, equipment, feelings, and memorable moments.",
          benefits: [
            "Track progression",
            "Remember great sessions",
            "Share experiences",
            "Build your surf story",
          ],
        },
        {
          title: "Photo Integration",
          description:
            "Add photos to your sessions to capture the memories and share the visual story of your surf adventures.",
          benefits: [
            "Visual memories",
            "Inspire others",
            "Document spots",
            "Social sharing",
          ],
        },
        {
          title: "Equipment Tracking",
          description:
            "Keep track of which boards and gear work best in different conditions to optimize your equipment choices.",
          benefits: [
            "Optimize gear selection",
            "Track board performance",
            "Share gear insights",
            "Equipment planning",
          ],
        },
        {
          title: "Session Analytics",
          description:
            "Visualize your surfing patterns with charts and insights about your session frequency, favorite spots, and progression.",
          benefits: [
            "Understand patterns",
            "Set goals",
            "Track improvement",
            "Motivate consistency",
          ],
        },
      ],
    },
    {
      id: "discovery",
      title: "Spot Discovery",
      description: "Explore new breaks and get local insights",
      features: [
        {
          title: "Interactive Surf Map",
          description:
            "Explore surf spots on an interactive map with real-time conditions, community ratings, and detailed information.",
          benefits: [
            "Discover new spots",
            "Plan surf trips",
            "Check conditions",
            "Get directions",
          ],
        },
        {
          title: "Community Reviews",
          description:
            "Read detailed reviews from local surfers covering wave quality, facilities, crowds, and insider tips.",
          benefits: [
            "Local knowledge",
            "Avoid crowds",
            "Find amenities",
            "Learn etiquette",
          ],
        },
        {
          title: "Real-time Conditions",
          description:
            "Get accurate, up-to-date surf conditions including wave height, wind, tide, and water temperature.",
          benefits: [
            "Plan sessions",
            "Avoid flat days",
            "Optimize timing",
            "Stay informed",
          ],
        },
        {
          title: "Forecast Integration",
          description:
            "Access detailed surf forecasts to plan your sessions and know when the best waves are coming.",
          benefits: [
            "Plan ahead",
            "Never miss good surf",
            "Optimize schedules",
            "Increase session success",
          ],
        },
      ],
    },
    {
      id: "planning",
      title: "Session Planning",
      description: "Plan the perfect surf session",
      features: [
        {
          title: "Session Planner",
          description:
            "Plan future surf sessions with date, location, conditions, and invite friends to join you.",
          benefits: [
            "Coordinate with friends",
            "Never surf alone",
            "Plan around forecasts",
            "Build anticipation",
          ],
        },
        {
          title: "Buddy Invitations",
          description:
            "Invite specific surfers to join your planned sessions and build your regular surf crew.",
          benefits: [
            "Surf with friends",
            "Share transport",
            "Safety in numbers",
            "More fun",
          ],
        },
        {
          title: "Calendar Integration",
          description:
            "Sync your surf plans with your calendar and get reminders about upcoming sessions.",
          benefits: [
            "Stay organized",
            "Don't miss sessions",
            "Plan around schedule",
            "Time management",
          ],
        },
        {
          title: "Weather Alerts",
          description:
            "Get notified when good surf is forecasted at your favorite spots so you never miss the magic.",
          benefits: [
            "Never miss good surf",
            "Spontaneous sessions",
            "Optimal timing",
            "Maximize wave count",
          ],
        },
      ],
    },
  ],
  cta: {
    title: "Ready to Join the Community?",
    description:
      "Experience all these features and more. Join thousands of surfers who've found their crew on Quiver.",
    buttonText: "Get Started Free",
    note: "Free to join • No credit card required",
  },
} as const;
