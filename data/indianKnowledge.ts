export type KnowledgeTopic =
  | "Government schemes"
  | "Education"
  | "Healthcare"
  | "Agriculture"
  | "Economy"
  | "Startups"
  | "Laws and policies";

export type KnowledgeChunk = {
  id: string;
  topic: KnowledgeTopic;
  title: string;
  content: string;
  source: string;
};

export const INDIAN_KNOWLEDGE_BASE: KnowledgeChunk[] = [
  {
    id: "gov-jan-dhan",
    topic: "Government schemes",
    title: "Pradhan Mantri Jan Dhan Yojana",
    content:
      "Pradhan Mantri Jan Dhan Yojana aims to expand access to basic banking services for underserved households. It offers zero-balance accounts, RuPay debit cards, accidental insurance, and enables direct benefit transfers and financial inclusion.",
    source: "Government of India",
  },
  {
    id: "gov-pmay",
    topic: "Government schemes",
    title: "Pradhan Mantri Awas Yojana",
    content:
      "Pradhan Mantri Awas Yojana supports affordable housing for low-income and economically weaker sections. The scheme helps families access pucca homes and improves living conditions in urban and rural areas.",
    source: "Ministry of Housing and Urban Affairs",
  },
  {
    id: "edu-nep2020",
    topic: "Education",
    title: "National Education Policy 2020",
    content:
      "The National Education Policy 2020 emphasizes multidisciplinary education, flexibility, foundational literacy and numeracy, teacher training, and a more holistic learning experience aligned to 21st-century skills.",
    source: "Ministry of Education",
  },
  {
    id: "edu-pm-shri",
    topic: "Education",
    title: "PM SHRI Schools",
    content:
      "PM SHRI aims to create model schools with modern infrastructure, digital learning, and strong governance. It focuses on quality education and inclusive school environments.",
    source: "Department of School Education",
  },
  {
    id: "health-ayushman",
    topic: "Healthcare",
    title: "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana",
    content:
      "Ayushman Bharat provides health insurance coverage to vulnerable families and helps them access secondary and tertiary care without facing catastrophic medical expenses.",
    source: "Ministry of Health and Family Welfare",
  },
  {
    id: "health-ndhm",
    topic: "Healthcare",
    title: "National Digital Health Mission",
    content:
      "The National Digital Health Mission creates digital health IDs, interoperable health records, and stronger access to healthcare services through digital infrastructure.",
    source: "National Health Authority",
  },
  {
    id: "agri-pm-kisan",
    topic: "Agriculture",
    title: "PM-KISAN",
    content:
      "PM-KISAN provides direct income support to eligible small and marginal farmer families. The scheme helps stabilize farm incomes and supports rural livelihoods.",
    source: "Ministry of Agriculture",
  },
  {
    id: "agri-crop-insurance",
    topic: "Agriculture",
    title: "Crop insurance and risk protection",
    content:
      "Crop insurance programs and weather-based risk support help farmers protect income against crop losses caused by drought, floods, pests, or other climatic events.",
    source: "Agriculture and Farmers Welfare Department",
  },
  {
    id: "econ-upi",
    topic: "Economy",
    title: "Unified Payments Interface",
    content:
      "Unified Payments Interface or UPI has transformed digital payments in India by making instant bank-to-bank transfers easy, low-cost, and widely adopted across consumers and merchants.",
    source: "NPCI",
  },
  {
    id: "econ-gst",
    topic: "Economy",
    title: "Goods and Services Tax",
    content:
      "GST simplified indirect taxation in India by creating a unified national tax structure. It improved transparency and made compliance more standardized across states.",
    source: "Central Board of Indirect Taxes and Customs",
  },
  {
    id: "startup-india",
    topic: "Startups",
    title: "Startup India",
    content:
      "Startup India promotes entrepreneurship by offering tax benefits, easier compliance, incubation support, and access to funding networks for new and growing ventures.",
    source: "Department for Promotion of Industry and Internal Trade",
  },
  {
    id: "law-dpdp",
    topic: "Laws and policies",
    title: "Digital Personal Data Protection Act",
    content:
      "The Digital Personal Data Protection Act sets rules for processing digital personal data in India, including consent, data minimization, and the rights of individuals over their data.",
    source: "Ministry of Electronics and Information Technology",
  },
  {
    id: "law-rti",
    topic: "Laws and policies",
    title: "Right to Information Act",
    content:
      "The Right to Information Act gives citizens the right to seek information from public authorities, supporting transparency, accountability, and participation in governance.",
    source: "Government of India",
  },
];
