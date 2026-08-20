import {
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
    title: "I built Quiver because I was tired of forecasts being wrong.",
    subtitle:
      "Forecasts missed the swell. Missed the wind. Missed whether it was even worth getting out of bed at 5am.",
  },
  problem: [
    "I was checking five different apps before every session. Surfline for the cam, Magic Seaweed for the swell, NOAA for the wind, some tide app, and then a group text to see if anyone was going out. And half the time I'd show up and conditions were nothing like what any of them said.",
    "The worst part? There was no way to say \"hey, this is wrong.\" No way to tell the next person that the south wind was actually hammering Blacks even though the forecast said offshore. You just showed up, got skunked, and drove home.",
  ],
  solution: {
    intro:
      "So I started building something different. Not another forecast aggregator — a platform that pulls real data from real sources and actually lets surfers tell each other what's happening.",
    stats: [
      { value: "279", label: "beaches" },
      { value: "131", label: "cities" },
      { value: "17", label: "states" },
      { value: "42K+", label: "forecasts" },
    ],
    closer:
      "Every forecast is built from NOAA buoy data and ML models trained on real ocean observations — not just recycled from the same source everyone else uses.",
  },
  whatsNext: [
    "Quiver is early. I'm not going to pretend it's finished. But that's kind of the point — I want the people who use it to help shape what it becomes.",
    "If the forecast was off at your spot, tell me. If there's a beach we're missing, tell me. If you want a feature that would make you actually open this thing every morning, I want to hear it.",
    "And if a forecast is wrong, I'd rather show you that than hide it. I shipped a model, caught a direction bug in our own data pipeline, fixed it, retrained, and kept the old predictions visible instead of rewriting history. That's the deal: I check my own work, and you get to see it.",
  ],
  cta: {
    title: "Come check it out.",
    subtitle:
      "Free. No credit card. No spam. Just better data for your next session.",
    primaryLabel: "Try the Swell Analyzer",
    primaryHref: "/tools/swell-analyzer",
    secondaryLabel: "Check your home break",
    secondaryHref: "/beaches",
    tertiaryLabel: "Or drop me a line",
    tertiaryHref: "mailto:support@quiversurf.app",
  },
} as const;

export const PRIVACY_CONTENT = {
  hero: {
    title: "Privacy Policy",
    subtitle: "How we protect and handle your data",
    lastUpdated: "July 25, 2026",
    effectiveDate:
      "This policy is effective as of July 25, 2026. We will notify you of any material changes by email or through our app.",
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
          "includes internet protocol (IP) address, device ID, login data, browser type and version, time zone setting and location, browsing patterns, operating system and platform. We also collect interaction data including page views, feature usage, scroll behavior, and navigation patterns through analytics services. Multiple analytics services may receive the same event data for redundancy and accuracy. Before you create an account, we collect anonymous browsing data (pages visited, beaches viewed) using a randomly generated identifier stored in your browser. When you sign up, this anonymous data is linked to your account to provide a better experience from the start.",
        sources: "Directly or indirectly from you, From third parties",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests, Necessary to comply with a legal obligation",
        disclosed:
          "Any person with your credentials, Diagnostic service providers, Data analytics service providers, Governmental authorities",
      },
      {
        name: "Usage Data",
        description:
          "includes information about how you use our Services, length of time spent, frequency of use, photographs, videos, comments, surf session data, and metadata. Email communications may include tracking to measure engagement such as opens and clicks. When you sign up, we may record how you discovered Quiver (e.g., referral source, landing page).",
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
        name: "Community Spot Photo Data",
        description:
          "When you submit a spot photo, we process the image, your versioned rights confirmation, the target beach or custom spot, votes, reports, and moderation status. For attribution, we resolve your current safe display name dynamically and link to your profile. If no safe display name exists, we show the non-linked label Quiver community instead. We strip EXIF metadata, including embedded GPS coordinates, before storage. Photos for canonical beaches and community-visible custom spots may be public. Photos for a private custom spot remain visible only to its owner and do not receive public attribution, votes, reports, or ranking.",
        sources: "Directly from contributors and other community members",
        purpose:
          "Performance of the community photo service, content safety, abuse prevention, and our legitimate interest in showing useful current spot imagery",
        disclosed:
          "Community members according to spot visibility, authorized Quiver moderators, and storage and image-processing service providers",
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
      {
        name: "Mobile Device Data",
        description:
          "When you use our mobile apps, we collect device push notification tokens (to send surf session invites, community updates, and notifications), device identifiers (for app analytics, crash reporting, and user authentication), device type and operating system version (for compatibility, support, and feature optimization), and mobile app usage patterns. For attributed Android installs, Google Play may deliver an opaque install attribution token. It is single-use and expires 30 days after issue. It resolves only to bounded campaign context and does not contain your email, Quiver user ID, Google identity, native install ID, precise timestamp, or location.",
        sources: "Directly from your mobile device",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests, Consent (for push notifications)",
        disclosed:
          "Push notification service providers (Apple Push Notification Service), Analytics service providers, Crash reporting services",
      },
      {
        name: "Android Tester Roster Data",
        description:
          "We operate a private Android tester roster to manage closed-test eligibility, support access, and measure the bounded test rollout. For people who have not linked a Quiver account, direct Google Group USER membership identity is encrypted in an AES-256-GCM envelope with a random IV and key version. We keep no reversible identity hash. When a tester account is linked, we immediately delete the raw external email and member ID. If an unjoined tester leaves the configured Group, a complete Directory snapshot marks the record ineligible and schedules raw identity deletion at exactly 30 days; rejoining before then cancels that deletion. Eligibility, Google Play opt-in, install, first open, and account join are independent timestamped evidence stages, and we never infer one stage from another. Google Play opt-in remains unknown unless we record separate manual evidence. Account deletion removes the user-linked roster record. We report aggregate rollout counts without personal information.",
        sources:
          "Google Workspace Directory direct Group membership, authenticated Quiver account join, bounded native install evidence, and manual Google Play evidence",
        purpose:
          "Performance of the closed-test service, Necessary for our legitimate interests in secure release operations and support",
        disclosed:
          "Authorized Quiver administrators and Google Workspace as the Group provider",
      },
      {
        name: "Live Camera Feed Data",
        description:
          "We display live video streams from third-party camera providers to show real-time beach conditions. These are publicly available livestreams that may capture individuals at public beaches. We do not record, store, or process video content from these feeds — streams are passed through to your device. Our servers may temporarily proxy video stream URLs to ensure reliable playback.",
        sources: "From third-party camera providers",
        purpose:
          "Performance of a contract, Necessary for our legitimate interests",
        disclosed:
          "Third-party camera stream providers (streams are passed through, not stored)",
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
            "As you interact with our Services, we automatically collect Technical and Usage Data about your equipment, browsing actions and patterns through cookies, web beacons, and similar technologies. We also assign a randomly generated visitor ID stored in your browser's localStorage to track anonymous browsing activity (beaches viewed, pages visited) before you sign up. This identifier is not linked to your identity until account creation.",
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
        {
          subtitle: "Mobile App",
          details:
            "When you use our mobile applications, we automatically collect certain device information including push notification tokens (to send you session invites and updates you've opted in to receive), device identifiers (for authentication and analytics), device model and operating system version (for compatibility and support), and app usage data (to improve features and user experience). Android installs reached through a Quiver web handoff may also return a short-lived opaque install attribution token from Google Play. Quiver stores only a cryptographic hash on the server and uses the token once to recover a bounded source, surface, placement, and campaign. You can control push notification permissions in your device settings at any time.",
        },
        {
          subtitle: "Live Camera Feeds",
          details:
            "We display live video streams from third-party camera providers to show real-time beach and surf conditions. These are publicly available livestreams. We do not record, store, or process video content from these feeds — streams are passed through directly to your device. Our servers may temporarily proxy video stream URLs to ensure reliable playback. Third-party camera operators have their own privacy policies governing stream capture and retention.",
        },
        {
          subtitle: "Analytics and Engagement Tracking",
          details:
            "We collect interaction data including page views, feature usage, scroll behavior, and navigation patterns through analytics services. Multiple analytics services may receive the same event data for redundancy and accuracy. Email communications may include tracking to measure engagement (opens, clicks). When you sign up, we may record how you discovered Quiver (e.g., referral source, landing page).",
        },
        {
          subtitle: "Community Spot Photos",
          details:
            "A spot-photo submission includes one processed image, the target spot, your versioned rights confirmation, and operational records needed for upvote, downvote, report, moderation, abuse limits, and removal. Before storage, Quiver re-encodes the image and strips EXIF metadata and embedded GPS coordinates. Eligible public photos are ordered by a confidence-adjusted score with no recency decay; an authorized administrator may place an audited pin, but a pin never overrides privacy, removal, or moderation eligibility.",
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
        {
          subtitle: "Machine Learning and Automated Analysis",
          details:
            "We use machine learning models to improve the accuracy of surf forecasts and wave predictions. Models are trained on aggregated, anonymized historical weather and ocean observation data from public sources. Individual user data is not used to train prediction models. Automated predictions supplement, but do not replace, source forecast data.",
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
            "Our service providers operate globally: Supabase (EU/US), Google Analytics (global), Vercel (global), Stripe (global), Sentry (global, error tracking and crash diagnostics), Mapbox (global, mapping and satellite imagery), and Firebase Cloud Messaging (global, push notifications). All transfers comply with applicable data protection laws and this Privacy Policy.",
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
        {
          subtitle: "Community Photo Removal",
          details:
            "When a contributor removes a community spot photo, it disappears from public and owner galleries immediately and enters a 30-day recovery period. After that period, Quiver permanently purges the image and recomputes affected ranking unless an authorized administrator places a documented investigation hold. A hold delays deletion only as long as needed for the investigation and is audited.",
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
      id: "third-party-services",
      icon: Globe,
      title: "Third-Party Services",
      content: [
        {
          subtitle: "Categories of Service Providers",
          details:
            "We work with various categories of third-party service providers to operate and improve Quiver, including: authentication and database services; payment processing services; analytics and performance monitoring services; email delivery services; error tracking and diagnostics services; push notification services; mapping and geocoding services; weather and ocean data providers; live camera stream providers; and cloud hosting and compute services.",
        },
        {
          subtitle: "Third-Party Data Practices",
          details:
            "Each third-party service provider operates under their own privacy policy and terms of service. We encourage you to review those policies. We select providers that maintain appropriate data protection standards and limit the personal data shared with each provider to what is necessary for the service they provide.",
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

export const TERMS_CONTENT = {
  hero: {
    title: "Terms of Service",
    subtitle: "Rules and guidelines for using Quiver",
    lastUpdated: "July 25, 2026",
    effectiveDate:
      "This policy is effective as of July 25, 2026. We will notify you of any material changes by email or through our app.",
  },
  overview: {
    title: "Welcome to Quiver",
    description:
      'These Terms of Service ("Terms") govern your use of the Quiver application, website, and services (collectively, the "Service"). By accessing or using Quiver, you agree to be bound by these Terms and our Privacy Policy.',
  },
  sections: [
    {
      id: "acceptance",
      icon: UserCheck,
      title: "1. Acceptance of Terms",
      content: [
        {
          subtitle: "Agreement to Terms",
          details:
            "By creating an account or using Quiver, you confirm that you are at least 13 years old and agree to these Terms. If you are under 18, you represent that your parent or guardian has reviewed and agreed to these Terms on your behalf. If you do not agree, do not use the Service.",
        },
      ],
    },
    {
      id: "service-description",
      icon: Waves,
      title: "2. Description of Service",
      content: [
        {
          subtitle: "What Quiver Provides",
          details:
            "Quiver provides surf forecasting, beach condition information, session tracking, and community features for surfers. Our Service includes: surf condition forecasts and predictions, machine learning-enhanced wave forecasts, real-time weather and ocean data, live beach camera feeds from third-party providers, beach and surf spot information, personal session logging and statistics, and community features including reviews and local intel.",
        },
        {
          subtitle: "Google Play Install Attribution",
          details:
            "After you complete the Android closed-test eligibility and opt-in guidance, Quiver may provide a Google Play install link containing an opaque, single-use install attribution token. The token expires after 30 days, carries no direct account or contact information, and is used only to measure the bounded web-to-app acquisition path. Invalid, expired, or already-consumed tokens do not prevent you from launching or using the Service.",
        },
        {
          subtitle: "Android Closed-Test Eligibility",
          details:
            "Direct USER membership in Quiver's configured Google Group establishes Android closed-test eligibility. Google Play opt-in is a separate step and is not guaranteed, inferred, or recorded as complete without separate manual evidence. Providing an email on Quiver's Android beta page is optional and does not gate Group access, Play access, or the install handoff.",
        },
      ],
    },
    {
      id: "user-accounts",
      icon: Users,
      title: "3. User Accounts",
      content: [
        {
          subtitle: "Account Responsibilities",
          details:
            "To access certain features, you must create an account. You agree to: provide accurate, current information during registration; maintain the security of your password and account; notify us immediately of any unauthorized access; and accept responsibility for all activity under your account. We reserve the right to suspend or terminate accounts that violate these Terms or remain inactive for extended periods.",
        },
      ],
    },
    {
      id: "user-content",
      icon: Database,
      title: "4. User Content",
      content: [
        {
          subtitle: "Your Content Rights",
          details:
            "You retain ownership of content you submit (session logs, reviews, photos, comments). By posting content, you grant Quiver a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content in connection with the Service.",
        },
        {
          subtitle: "Spot Photo Rights and Publication",
          details:
            "Before submitting a community spot photo, you must confirm that you took the photo or otherwise have all rights needed to share and license it. Subject to the spot's visibility, an accepted photo is immediately published without advance editorial review. The license above includes processing, resizing, displaying, ranking, and distributing the photo through Quiver while you retain ownership.",
        },
        {
          subtitle: "Community Ranking and Moderation",
          details:
            "Eligible public photos may receive an upvote or downvote from each community member and may be reported for safety, privacy, explicit content, or incorrect or stale imagery. Quiver uses those signals for confidence-adjusted ranking with no recency decay. Authorized administrators may audit and reverse moderation decisions, place or remove a featured pin, and place an investigation hold. A pin never makes hidden, removed, or private content eligible for public display.",
        },
        {
          subtitle: "Removal and Recovery",
          details:
            "You may remove your community spot photo at any time. Removal hides it immediately, and Quiver keeps it for 30 days so you may recover it before permanent deletion unless a documented investigation hold is active. Moderation, legal, safety, or abuse-prevention obligations may limit restoration or require temporary retention.",
        },
        {
          subtitle: "Content Restrictions",
          details:
            "You agree not to post content that: is false, misleading, or defamatory; infringes intellectual property rights; contains harassment, hate speech, or threats; is spam or commercial solicitation; or violates any applicable law. We may remove content that violates these Terms without notice.",
        },
      ],
    },
    {
      id: "forecast-disclaimer",
      icon: Waves,
      title: "5. Surf Forecast Disclaimer",
      content: [
        {
          subtitle: "IMPORTANT NOTICE",
          details:
            "QUIVER PROVIDES SURF FORECASTS, WAVE PREDICTIONS, AND OCEAN CONDITION INFORMATION FOR GENERAL INFORMATIONAL PURPOSES ONLY. THIS INFORMATION IS NOT A SUBSTITUTE FOR YOUR OWN JUDGMENT, LOCAL KNOWLEDGE, OR PROFESSIONAL INSTRUCTION.",
        },
        {
          subtitle: "Machine Learning Predictions",
          details:
            "Forecasts may incorporate machine learning predictions derived from historical data patterns and real-time observations. Automated models are continuously updated and may produce varying results. You acknowledge that algorithmic predictions are subject to inherent limitations and should not be relied upon as the sole basis for decisions regarding ocean safety.",
        },
        {
          subtitle: "Your Acknowledgment",
          details:
            "You acknowledge and agree that: ocean conditions are inherently unpredictable and can change rapidly; forecasts are predictions based on available data and may be inaccurate; local conditions may differ significantly from forecasted conditions; you are solely responsible for assessing conditions before entering the water; and Quiver does not guarantee the accuracy, completeness, or timeliness of any forecast.",
        },
      ],
    },
    {
      id: "live-camera-feeds",
      icon: Eye,
      title: "6. Live Camera Feeds",
      content: [
        {
          subtitle: "Third-Party Camera Streams",
          details:
            "Quiver displays third-party live camera streams for informational purposes only. Camera feeds are publicly available content provided by independent third-party operators, not by Quiver. Camera availability, quality, angles, and stream reliability are not guaranteed and may change without notice.",
        },
        {
          subtitle: "Public Beach Recording",
          details:
            "By visiting public beaches where cameras are present, you acknowledge you may appear in publicly accessible livestreams displayed through our Service. Quiver does not control, moderate, or store camera feed content and is not responsible for third-party camera operators' practices.",
        },
      ],
    },
    {
      id: "assumption-of-risk",
      icon: Shield,
      title: "7. Assumption of Risk",
      content: [
        {
          subtitle: "INHERENT DANGERS",
          details:
            "SURFING AND OCEAN ACTIVITIES ARE INHERENTLY DANGEROUS AND CAN RESULT IN SERIOUS INJURY OR DEATH. By using Quiver, you acknowledge that you understand these risks and voluntarily assume full responsibility for any injury, loss, or damage that may occur.",
        },
        {
          subtitle: "Specific Risks",
          details:
            "Risks include but are not limited to: drowning; collisions with other surfers, watercraft, or marine life; impact with the ocean floor, rocks, or reef; dangerous currents, rip tides, and shore break; hypothermia and sun exposure; and equipment failure. Quiver does not assess your skill level, physical condition, or ability to handle specific conditions. You are solely responsible for making safe decisions.",
        },
      ],
    },
    {
      id: "limitation-of-liability",
      icon: Lock,
      title: "8. Limitation of Liability",
      content: [
        {
          subtitle: "Liability Cap",
          details:
            "TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUIVER AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO PERSONAL INJURY, DEATH, PROPERTY DAMAGE, LOSS OF DATA, OR LOSS OF PROFITS, ARISING FROM YOUR USE OF THE SERVICE.",
        },
        {
          subtitle: "Maximum Damages",
          details:
            "IN NO EVENT SHALL QUIVER'S TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID TO QUIVER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER. Some jurisdictions do not allow limitation of liability for personal injury or death. In such jurisdictions, our liability is limited to the maximum extent permitted by law.",
        },
      ],
    },
    {
      id: "indemnification",
      icon: Shield,
      title: "9. Indemnification",
      content: [
        {
          subtitle: "Your Agreement to Indemnify",
          details:
            "You agree to indemnify and hold harmless Quiver and its affiliates from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your content, or your violation of these Terms.",
        },
      ],
    },
    {
      id: "acceptable-use",
      icon: Target,
      title: "10. Acceptable Use",
      content: [
        {
          subtitle: "Prohibited Activities",
          details:
            "You agree not to: use the Service for any illegal purpose; attempt to gain unauthorized access to any part of the Service; interfere with or disrupt the Service or servers; scrape, crawl, or collect data without permission; impersonate others or misrepresent your affiliation; use automated systems to access the Service without permission; or reverse engineer or attempt to extract source code.",
        },
      ],
    },
    {
      id: "intellectual-property",
      icon: Globe,
      title: "11. Intellectual Property",
      content: [
        {
          subtitle: "Ownership",
          details:
            "The Service, including its design, features, content, and trademarks, is owned by Quiver and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.",
        },
      ],
    },
    {
      id: "third-party-services",
      icon: Globe,
      title: "12. Third-Party Services",
      content: [
        {
          subtitle: "External Services",
          details:
            "Quiver integrates with third-party services for maps, weather data, and other features. Your use of these services is subject to their respective terms and privacy policies. Quiver is not responsible for third-party content or services.",
        },
      ],
    },
    {
      id: "termination",
      icon: Trash2,
      title: "13. Termination",
      content: [
        {
          subtitle: "Account Termination",
          details:
            "We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination (including disclaimers, limitations of liability, and indemnification) shall survive.",
        },
      ],
    },
    {
      id: "arbitration",
      icon: Settings,
      title: "14. Dispute Resolution and Arbitration",
      content: [
        {
          subtitle: "PLEASE READ CAREFULLY",
          details:
            "THIS SECTION AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.",
        },
        {
          subtitle: "Agreement to Arbitrate",
          details:
            'You and Quiver agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service (collectively, "Disputes") will be resolved by binding individual arbitration rather than in court, except that either party may bring individual claims in small claims court if they qualify.',
        },
        {
          subtitle: "Class Action Waiver",
          details:
            "YOU AND QUIVER AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE PROCEEDING. Unless both you and Quiver agree otherwise, the arbitrator may not consolidate or join more than one person's claims and may not preside over any form of a representative, class, or collective proceeding.",
        },
        {
          subtitle: "Arbitration Rules",
          details:
            "The arbitration will be administered by JAMS under its Streamlined Arbitration Rules and Procedures, or as otherwise agreed by the parties. The arbitration will be conducted in the English language in the county where you reside or another mutually agreed location.",
        },
        {
          subtitle: "Opt-Out Right",
          details:
            "You may opt out of this arbitration agreement by sending written notice to legal@quiversurf.com within 30 days of creating your account. If you opt out, you and Quiver may still resolve Disputes in small claims court or through litigation in accordance with Section 15.",
        },
        {
          subtitle: "Severability",
          details:
            "If any part of this arbitration agreement is found unenforceable, the remaining portions shall remain in effect. If the class action waiver is found unenforceable for a particular claim, then the entire arbitration agreement shall be null and void for that claim only, and the Dispute shall proceed in court.",
        },
      ],
    },
    {
      id: "governing-law",
      icon: Globe,
      title: "15. Governing Law",
      content: [
        {
          subtitle: "Applicable Law",
          details:
            "These Terms are governed by the laws of the State of California, United States, without regard to conflict of law principles. For any Disputes not subject to arbitration, you agree to submit to the personal and exclusive jurisdiction of the state and federal courts located in California.",
        },
      ],
    },
    {
      id: "changes",
      icon: Settings,
      title: "16. Changes to Terms",
      content: [
        {
          subtitle: "Updates",
          details:
            'We may update these Terms from time to time. We will notify you of material changes by posting the new Terms and updating the "Last Updated" date. Your continued use after changes constitutes acceptance of the revised Terms.',
        },
      ],
    },
  ],
  contact: {
    title: "Contact Information",
    description:
      "If you have any questions about these Terms, please contact us:",
    methods: [
      {
        type: "Email",
        value: "legal@quiversurf.com",
      },
      {
        type: "Website",
        value: "quiversurf.com",
      },
      {
        type: "Postal Address",
        value:
          "Quiver Surf Technologies, 2261 Market Street STE 10852, San Francisco, CA 94114, Attn: Legal",
      },
    ],
  },
} as const;

export const FEATURES_EXTENDED_CONTENT = {
  hero: {
    title: "Find your home break.",
    subtitle:
      "Pick your spot. Get conditions explained for your level. Free, updated every 3 hours.",
  },
} as const;
