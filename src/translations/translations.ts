export type Language = 'en' | 'mr';

export interface TranslationDictionary {
  nav: {
    home: string;
    about: string;
    products: string;
    industries: string;
    quality: string;
    gallery: string;
    contact: string;
    requestQuote: string;
    admin: string;
    switchLang: string;
  };
  hero: {
    tagline: string;
    heading1: string;
    heading2: string;
    subheading: string;
    exploreProducts: string;
    requestQuotation: string;
    precisionCardTitle: string;
    focusLabel: string;
    focusDesc: string;
    supplyLabel: string;
    supplyDesc: string;
    appLabel: string;
    appDesc: string;
    customerLabel: string;
    customerDesc: string;
    bar1: string;
    bar2: string;
    bar3: string;
    bar4: string;
  };
  about: {
    eyebrow: string;
    title: string;
    p1: string;
    p2: string;
    keyHighlights: string;
    badge1Title: string;
    badge1Desc: string;
    badge2Title: string;
    badge2Desc: string;
    badge3Title: string;
    badge3Desc: string;
    badge4Title: string;
    badge4Desc: string;
  };
  products: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tabAll: string;
    tabRubber: string;
    tabPlastic: string;
    tabCustom: string;
    viewSpecs: string;
    requestQuote: string;
  };
  industries: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  references: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  whyUs: {
    eyebrow: string;
    title: string;
  };
  quality: {
    eyebrow: string;
    title: string;
    b1Title: string;
    b1Desc: string;
    b2Title: string;
    b2Desc: string;
    b3Title: string;
    b3Desc: string;
  };
  gallery: {
    eyebrow: string;
    title: string;
  };
  enquiry: {
    eyebrow: string;
    title: string;
    subtitle: string;
    checklistTitle: string;
    c1: string;
    c2: string;
    c3: string;
    c4: string;
    directHotline: string;
    companyName: string;
    companyNamePlaceholder: string;
    contactPerson: string;
    contactPersonPlaceholder: string;
    email: string;
    mobile: string;
    productCategory: string;
    quantity: string;
    quantityPlaceholder: string;
    technicalReq: string;
    technicalReqPlaceholder: string;
    uploadLabel: string;
    uploadText: string;
    maxSize: string;
    additionalMsg: string;
    additionalMsgPlaceholder: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successDesc: string;
    refNotice: string;
    submitAnother: string;
  };
  contact: {
    eyebrow: string;
    title: string;
    addressHeading: string;
    addressVal: string;
    phonesHeading: string;
    hoursHeading: string;
    hoursVal: string;
    gstHeading: string;
    whatsappBtn: string;
  };
  footer: {
    desc: string;
    gstLabel: string;
    stateCode: string;
    componentsCol: string;
    companyCol: string;
    officeCol: string;
    rights: string;
    gstTag: string;
    adminLink: string;
  };
  quoteModal: {
    title: string;
    dispatched: string;
    desc: string;
    close: string;
    speakDirectly: string;
  };
  productModal: {
    idPrefix: string;
    specBadge: string;
    availPolymer: string;
    reqQuoteBtn: string;
    primaryApps: string;
    perfNotes: string;
    relatedTitle: string;
  };
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    nav: {
      home: 'Home',
      about: 'About',
      products: 'Products',
      industries: 'Industries',
      quality: 'Quality',
      gallery: 'Gallery',
      contact: 'Contact',
      requestQuote: 'REQUEST A QUOTE',
      admin: 'Admin Portal',
      switchLang: 'मराठी',
    },
    hero: {
      tagline: 'BABA ENTERPRISES · INDUSTRIAL RUBBER & PLASTIC COMPONENTS',
      heading1: 'ENGINEERING RELIABILITY.',
      heading2: 'INDUSTRIAL PRECISION.',
      subheading: 'Dependable rubber and plastic component solutions for industrial and engineering requirements.',
      exploreProducts: 'EXPLORE OUR PRODUCTS',
      requestQuotation: 'REQUEST A QUOTATION',
      precisionCardTitle: 'PRECISION COMPONENTS FOR A STRONGER INDUSTRY',
      focusLabel: 'Industrial Product Focus',
      focusDesc: 'Wide range of rubber & plastic components',
      supplyLabel: 'Reliable Supply',
      supplyDesc: 'Consistent quality and timely delivery',
      appLabel: 'Engineering Applications',
      appDesc: 'Solutions for critical industrial requirements',
      customerLabel: 'Customer-Oriented Approach',
      customerDesc: 'Long-term relationships and dedicated support',
      bar1: 'Supplying to Leading Industrial Organisations',
      bar2: 'Wide Range of Rubber & Plastic Components',
      bar3: 'Customised Component Solutions',
      bar4: 'Serving Diverse Industrial Applications',
    },
    about: {
      eyebrow: 'ABOUT BABA ENTERPRISES',
      title: 'Precision Engineering & Component Excellence',
      p1: "Located in Bhosari, Pune — Maharashtra's premier industrial manufacturing hub — BABA ENTERPRISES specializes in manufacturing and supplying high-performance industrial rubber and plastic components.",
      p2: 'We serve demanding industrial sectors including heavy engineering, electrical equipment, infrastructure projects, automotive systems, and defence establishments. Our commitment to dimensional accuracy, compounding precision, and dependable batch consistency makes us a trusted manufacturing partner.',
      keyHighlights: 'Key Manufacturing Strengths',
      badge1Title: 'Custom Moulding & Extrusion',
      badge1Desc: 'Precision moulding to drawing specifications',
      badge2Title: 'Material Expertise',
      badge2Desc: 'NBR, Neoprene, EPDM, Silicone, Viton, Nylon, Polyurethane',
      badge3Title: 'Quality & Dimensional Checks',
      badge3Desc: 'Rigorous quality control for reliable performance',
      badge4Title: 'Industrial Hub Advantage',
      badge4Desc: 'Strategic Bhosari location for rapid logistics across India',
    },
    products: {
      eyebrow: 'INDUSTRIAL COMPONENT CATALOGUE',
      title: 'Precision Engineered Components',
      subtitle: 'Explore our comprehensive range of custom moulded, extruded, and machined rubber and plastic components engineered to exact industrial specifications.',
      tabAll: 'All Component Categories',
      tabRubber: 'Industrial Rubber Products',
      tabPlastic: 'Industrial Plastic Components',
      tabCustom: 'Custom Moulded Parts',
      viewSpecs: 'View Specifications',
      requestQuote: 'Request Quotation',
    },
    industries: {
      eyebrow: 'KEY INDUSTRIAL SECTORS',
      title: 'Serving Critical Engineering Applications',
      subtitle: 'Our components perform reliably across demanding working environments, severe thermal ranges, and stringent technical standards.',
    },
    references: {
      eyebrow: 'OUR VALUED CUSTOMERS',
      title: 'Trusted by Premier Organizations',
      subtitle: 'Demonstrated component supply capability to leading public sector undertakings, defence establishments, and heavy industrial original equipment manufacturers.',
    },
    whyUs: {
      eyebrow: 'THE BABA ENTERPRISES ADVANTAGE',
      title: 'Why Leading Engineers Trust Us',
    },
    quality: {
      eyebrow: 'ENGINEERING & QUALITY ASSURANCE',
      title: 'Uncompromising Standards for Industrial Reliability',
      b1Title: 'Compounding Precision',
      b1Desc: 'Optimal polymer formulations for temperature, chemical, and pressure resilience.',
      b2Title: 'Dimensional Accuracy',
      b2Desc: 'Tight tolerance machining and moulding based on customer technical drawings.',
      b3Title: 'Batch Consistency',
      b3Desc: 'Repeatable quality across small prototype batches to high-volume production runs.',
    },
    gallery: {
      eyebrow: 'COMPONENT GALLERY',
      title: 'Industrial Manufacturing Portfolio',
    },
    enquiry: {
      eyebrow: 'TECHNICAL PROCUREMENT · DIRECT COMMERCIAL ENQUIRY',
      title: 'HAVE AN INDUSTRIAL COMPONENT REQUIREMENT?',
      subtitle: 'Submit your component requirements, target quantities, and engineering specifications. Our technical team will review your parameters and provide a comprehensive commercial quotation.',
      checklistTitle: 'What to include for fast quotation:',
      c1: 'Dimensional Details: 2D PDF drawing, internal/external diameters, and wall thickness.',
      c2: 'Material Grade: NBR, Neoprene, EPDM, Silicone, Viton, or preferred polymer.',
      c3: 'Duty Environment: Temperature range, fluid exposure (hydraulic oil, water, acid).',
      c4: 'Quantity / Supply Schedule: One-off batch or recurring monthly delivery volume.',
      directHotline: 'Direct Hotline:',
      companyName: 'Company Name',
      companyNamePlaceholder: 'e.g. Pune Engineering Works',
      contactPerson: 'Contact Person',
      contactPersonPlaceholder: 'e.g. Rajesh Sharma',
      email: 'Business Email',
      mobile: 'Mobile Number (India)',
      productCategory: 'Product Category',
      quantity: 'Quantity Required',
      quantityPlaceholder: 'e.g. 2,000 pcs or monthly supply',
      technicalReq: 'Technical Requirements (Material, Dimensions, Hardness)',
      technicalReqPlaceholder: 'e.g. Nitrile 70 Shore A, OD 45mm x ID 20mm x Thk 5mm, oil resistant',
      uploadLabel: 'Upload Engineering Drawing or Reference Image (Optional)',
      uploadText: 'Click to attach drawing (PDF, PNG, JPG, DWG, STEP)',
      maxSize: 'Maximum file size: 10MB',
      additionalMsg: 'Additional Message or Delivery Location',
      additionalMsgPlaceholder: 'Specify delivery destination, target timeline, or special testing requirements...',
      submit: 'SUBMIT ENQUIRY',
      submitting: 'Processing Technical Enquiry...',
      successTitle: 'Enquiry Successfully Received',
      successDesc: 'Thank you for reaching out to BABA ENTERPRISES. Your requirement has been registered in our procurement system.',
      refNotice: 'Acknowledgement Reference',
      submitAnother: 'Submit Another Requirement',
    },
    contact: {
      eyebrow: 'OFFICIAL BUSINESS LOCATION',
      title: 'Connect with BABA ENTERPRISES',
      addressHeading: 'Registered Office & Facility Address',
      addressVal: 'Sr. No. 229/2, Shree Gajanan Housing Society, Khandobamal, Bhosari, Pune – 411039, Maharashtra, India.',
      phonesHeading: 'Direct Phone & Sales Desk',
      hoursHeading: 'Operational Hours',
      hoursVal: 'Monday – Saturday: 9:00 AM – 7:00 PM (IST)',
      gstHeading: 'GSTIN & State Code',
      whatsappBtn: 'Chat on WhatsApp',
    },
    footer: {
      desc: 'BABA ENTERPRISES is an industrial rubber and plastic components supplier based in Bhosari, Pune, Maharashtra. Supplying precision rubber mouldings, custom sealing products, and engineering components with dependable quality and customer-oriented service.',
      gstLabel: 'GSTIN:',
      stateCode: '· State Code: 27 (MH)',
      componentsCol: 'Components',
      companyCol: 'Company',
      officeCol: 'Registered Office',
      rights: '© BABA ENTERPRISES. All Rights Reserved.',
      gstTag: 'GST Registered Industrial Supplier',
      adminLink: 'Admin Portal',
    },
    quoteModal: {
      title: 'Request Industrial Quotation',
      dispatched: 'Quotation Request Dispatched',
      desc: 'Your request has been logged. Our sales desk in Bhosari will review and connect with you shortly.',
      close: 'Close Window',
      speakDirectly: 'Or speak to procurement directly:',
    },
    productModal: {
      idPrefix: 'ID:',
      specBadge: 'BABA ENTERPRISES Spec',
      availPolymer: 'Available Polymer Formulations:',
      reqQuoteBtn: 'Request Quotation for this Component',
      primaryApps: 'Primary Engineering Applications',
      perfNotes: 'Performance & Quality Notes',
      relatedTitle: 'Related Industrial Components',
    },
  },
  mr: {
    nav: {
      home: 'मुख्यपृष्ठ',
      about: 'आमच्याबद्दल',
      products: 'उत्पादने',
      industries: 'उद्योग क्षेत्रे',
      quality: 'गुणवत्ता',
      gallery: 'गॅलरी',
      contact: 'संपर्क',
      requestQuote: 'कोटेशन मागवा',
      admin: 'ॲडमिन पोर्टल',
      switchLang: 'EN',
    },
    hero: {
      tagline: 'बाबा एंटरप्रायझेस · औद्योगिक रबर आणि प्लास्टिक घटक',
      heading1: 'इंजिनिअरिंग विश्वासार्हता.',
      heading2: 'औद्योगिक अचूकता.',
      subheading: 'औद्योगिक आणि इंजिनिअरिंग गरजांसाठी विश्वासार्ह रबर आणि प्लास्टिक घटकांची उच्च दर्जाची उत्पादने.',
      exploreProducts: 'उत्पादने पाहा',
      requestQuotation: 'कोटेशन मागवा',
      precisionCardTitle: 'मजबूत उद्योगासाठी अचूक इंजिनिअरिंग घटक',
      focusLabel: 'औद्योगिक घटक श्रेणी',
      focusDesc: 'रबर आणि प्लास्टिक घटकांची विस्तृत श्रेणी',
      supplyLabel: 'विश्वासार्ह पुरवठा',
      supplyDesc: 'उत्कृष्ट गुणवत्ता व वेळेवर पुरवठा',
      appLabel: 'इंजिनिअरिंग ॲप्लिकेशन्स',
      appDesc: 'महत्त्वाच्या औद्योगिक गरजांसाठी उपाय',
      customerLabel: 'ग्राहक-केंद्रित कार्यपद्धती',
      customerDesc: 'दीर्घकालीन व्यावसायिक संबंध व तत्पर सेवा',
      bar1: 'प्रमुख औद्योगिक संस्थांना पुरवठादार',
      bar2: 'रबर आणि प्लास्टिक घटकांची विस्तृत श्रेणी',
      bar3: 'कस्टम घटकांची अचूक निर्मिती',
      bar4: 'विविध औद्योगिक क्षेत्रांसाठी सेवा',
    },
    about: {
      eyebrow: 'बाबा एंटरप्रायझेस विषयी',
      title: 'अचूक इंजिनिअरिंग आणि घटकांची उत्कृष्ट निर्मिती',
      p1: 'भोसरी, पुणे — महाराष्ट्राच्या प्रमुख औद्योगिक उत्पादन केंद्रात स्थित — बाबा एंटरप्रायझेस उच्च क्षमतेच्या औद्योगिक रबर आणि प्लास्टिक घटकांच्या निर्मिती व पुरवठ्यात विशेष प्राविण्य राखते.',
      p2: 'आम्ही हेवी इंजिनिअरिंग, इलेक्ट्रिकल उपकरणे, पायाभूत सुविधा प्रकल्प, ऑटोमोटिव्ह सिस्टीम्स आणि संरक्षण क्षेत्रातील महत्त्वपूर्ण औद्योगिक संस्थांना सेवा देतो. आकारमानाची अचूकता, उच्च गुणवत्तेचे कम्पाउंडिंग आणि बॅचची सुसंगतता ही आमची ओळख आहे.',
      keyHighlights: 'उत्पादनाची मुख्य वैशिष्ट्ये',
      badge1Title: 'कस्टम मोल्डिंग आणि एक्सट्रूजन',
      badge1Desc: 'नकाशा व डिझाइननुसार अचूक मोल्डिंग',
      badge2Title: 'मटेरियल क्षेत्रातील तज्ज्ञता',
      badge2Desc: 'एनबीआर, निओप्रिन, ईपीडीएम, सिलिकॉन, व्हिटॉन, नायलॉन, पॉलियुरेथेन',
      badge3Title: 'गुणवत्ता आणि परिमाण चाचणी',
      badge3Desc: 'विश्वासार्ह कामगिरीसाठी कडक गुणवत्ता नियंत्रण',
      badge4Title: 'औद्योगिक केंद्राचा फायदा',
      badge4Desc: 'भारतात जलद वाहतुकीसाठी भोसरी (पुणे) येथील मोक्याचे ठिकाण',
    },
    products: {
      eyebrow: 'औद्योगिक घटक कॅटलॉग',
      title: 'अचूक इंजिनिअरिंग घटक',
      subtitle: 'अचूक औद्योगिक निकषांनुसार तयार केलेल्या आमच्या कस्टम मोल्डेड, एक्सट्रूडेड आणि मशीन केलेल्या रबर व प्लास्टिक घटकांची संपूर्ण श्रेणी पाहा.',
      tabAll: 'सर्व घटक श्रेणी',
      tabRubber: 'औद्योगिक रबर उत्पादने',
      tabPlastic: 'औद्योगिक प्लास्टिक घटक',
      tabCustom: 'कस्टम मोल्डेड भाग',
      viewSpecs: 'तपशील पाहा',
      requestQuote: 'कोटेशन मागवा',
    },
    industries: {
      eyebrow: 'प्रमुख औद्योगिक क्षेत्रे',
      title: 'महत्त्वाच्या इंजिनिअरिंग क्षेत्रांना सेवा',
      subtitle: 'आमचे घटक आव्हानात्मक कार्य वातावरण, उच्च तापमान श्रेणी आणि कठोर तांत्रिक मानकांमध्येही उत्तम कामगिरी बजावतात.',
    },
    references: {
      eyebrow: 'आमचे सन्माननीय ग्राहक',
      title: 'प्रमुख संस्थांचा ठाम विश्वास',
      subtitle: 'सार्वजनिक क्षेत्रातील उपक्रम, संरक्षण संशोधन संस्था आणि हेवी इंडस्ट्रियल मूळ उपकरणांच्या उत्पादकांशी (OEMs) जोडलेले आमचे व्यावसायिक नाते.',
    },
    whyUs: {
      eyebrow: 'बाबा एंटरप्रायझेसचे वैशिष्ट्य',
      title: 'इंजिनिअर्स आमच्यावर का विश्वास ठेवतात',
    },
    quality: {
      eyebrow: 'इंजिनिअरिंग आणि गुणवत्ता हमी',
      title: 'औद्योगिक विश्वासार्हतेसाठी बिनतडजोड मानके',
      b1Title: 'उत्कृष्ट कंपाउंडिंग',
      b1Desc: 'तापमान, रसायन आणि दाबाच्या प्रतिकारासाठी सुसंगत पॉलिमर फॉर्म्युलेशन.',
      b2Title: 'अचूक परिमाणे (टॉलरन्स)',
      b2Desc: 'ग्राहकांच्या तांत्रिक नकाशानुसार अत्यंत बारीक टॉलरन्स मोल्डिंग आणि मशीनिंग.',
      b3Title: 'एकसमान बॅच गुणवत्ता',
      b3Desc: 'लहान प्रोटोटाइपपासून ते मोठ्या लॉटपर्यंत उत्पादनाची एकसमान गुणवत्ता.',
    },
    gallery: {
      eyebrow: 'घटक गॅलरी',
      title: 'औद्योगिक उत्पादन पोर्टफोलिओ',
    },
    enquiry: {
      eyebrow: 'तांत्रिक खरेदी · थेट व्यावसायिक चौकशी',
      title: 'तुमच्याकडे औद्योगिक घटकांची मागणी आहे का?',
      subtitle: 'तुमच्या घटकांच्या गरजा, प्रमाण आणि तांत्रिक वैशिष्ट्ये पाठवा. आमची तांत्रिक टीम तपासून योग्य व्यापारी कोटेशन देईल.',
      checklistTitle: 'जलद कोटेशनसाठी काय समाविष्ट करावे:',
      c1: 'परिमाणांचा तपशील: 2D PDF नकाशा, अंतर्गत/बाह्य व्यास आणि जाडी.',
      c2: 'मटेरियल ग्रेड: NBR, Neoprene, EPDM, Silicone, Viton किंवा इच्छित पॉलिमर.',
      c3: 'कार्य वातावरण: तापमान श्रेणी, द्रव संपर्क (हायड्रोलिक तेल, पाणी, आम्ल).',
      c4: 'नग / पुरवठा वेळापत्रक: एकवेळचा लॉट किंवा दरमहा पुरवठा.',
      directHotline: 'थेट संपर्क नंबर:',
      companyName: 'कंपनीचे नाव',
      companyNamePlaceholder: 'उदा. पुणे इंजिनिअरिंग वर्क्स',
      contactPerson: 'संपर्क व्यक्ती',
      contactPersonPlaceholder: 'उदा. राजेश शर्मा',
      email: 'व्यावसायिक ईमेल',
      mobile: 'मोबाईल नंबर (भारत)',
      productCategory: 'उत्पादन श्रेणी',
      quantity: 'आवश्यक प्रमाण',
      quantityPlaceholder: 'उदा. २,००० नग किंवा मासिक पुरवठा',
      technicalReq: 'तांत्रिक गरजा (मटेरियल, परिमाणे, कडकपणा)',
      technicalReqPlaceholder: 'उदा. नायट्रिल ७० शोअर ए, ओडी ४५मिमी x आयडी २०मिमी, तेल प्रतिरोधक',
      uploadLabel: 'इंजिनिअरिंग नकाशा किंवा फोटो अपलोड करा (पर्यायी)',
      uploadText: 'नकाशा जोडण्यासाठी क्लिक करा (PDF, PNG, JPG, DWG, STEP)',
      maxSize: 'कमाल फाईल आकार: १० MB',
      additionalMsg: 'अतिरिक्त माहिती किंवा डिलिव्हरी ठिकाण',
      additionalMsgPlaceholder: 'डिलिव्हरीचे ठिकाण, वेळ किंवा विशेष चाचणी गरजा नमूद करा...',
      submit: 'चौकशी अर्ज पाठवा',
      submitting: 'चौकशी प्रक्रियेत आहे...',
      successTitle: 'चौकशी अर्ज यशस्वीपणे प्राप्त झाला',
      successDesc: 'बाबा एंटरप्रायझेसशी संपर्क साधल्याबद्दल धन्यवाद. तुमची मागणी आमच्या सिस्टीममध्ये नोंदवली गेली आहे.',
      refNotice: 'पावती संदर्भ क्रमांक',
      submitAnother: 'दुसरी चौकशी नोंदवा',
    },
    contact: {
      eyebrow: 'अधिकृत व्यवसाय ठिकाण',
      title: 'बाबा एंटरप्रायझेसशी संपर्क साधा',
      addressHeading: 'नोंदणीकृत कार्यालय आणि कारखाना पत्ता',
      addressVal: 'सर्व्हे क्र. २२९/२, श्री गजानन हाऊसिंग सोसायटी, खंडोबामाळ, भोसरी, पुणे – ४११०३९, महाराष्ट्र, भारत.',
      phonesHeading: 'थेट फोन आणि विक्री विभाग',
      hoursHeading: 'कामकाजाची वेळ',
      hoursVal: 'सोमवार – शनिवार: सकाळी ९:०० ते संध्याकाळी ७:०० (भारतीय वेळ)',
      gstHeading: 'जीएसटी क्रमांक आणि राज्य कोड',
      whatsappBtn: 'व्हॉट्सॲपवर चॅट करा',
    },
    footer: {
      desc: 'बाबा एंटरप्रायझेस ही भोसरी, पुणे (महाराष्ट्र) येथील औद्योगिक रबर आणि प्लास्टिक घटकांची पुरवठादार कंपनी आहे. आम्ही उत्कृष्ट गुणवत्तेसह अचूक रबर मोल्डिंग्स, कस्टम सीलिंग उत्पादने आणि इंजिनिअरिंग घटकांचा पुरवठा करतो.',
      gstLabel: 'जीएसटीआयएन:',
      stateCode: '· राज्य कोड: २७ (महाराष्ट्र)',
      componentsCol: 'घटक श्रेणी',
      companyCol: 'कंपनी',
      officeCol: 'पर्यायी दुवे',
      rights: '© बाबा एंटरप्रायझेस. सर्व हक्क सुरक्षित.',
      gstTag: 'जीएसटी नोंदणीकृत औद्योगिक पुरवठादार',
      adminLink: 'ॲडमिन पोर्टल',
    },
    quoteModal: {
      title: 'औद्योगिक कोटेशन मागवा',
      dispatched: 'कोटेशन विनंती पाठवली गेली',
      desc: 'तुमची मागणी नोंदवली आहे. भोसरी येथील आमचा विक्री विभाग लवकरच तुमच्याशी संपर्क साधेल.',
      close: 'खिडकी बंद करा',
      speakDirectly: 'किंवा थेट विक्री विभागाशी बोला:',
    },
    productModal: {
      idPrefix: 'आयडी:',
      specBadge: 'बाबा एंटरप्रायझेस तपशील',
      availPolymer: 'उपलब्ध पॉलिमर प्रकार:',
      reqQuoteBtn: 'या घटकासाठी कोटेशन मागवा',
      primaryApps: 'मुख्य इंजिनिअरिंग ॲप्लिकेशन्स',
      perfNotes: 'कामगिरी आणि गुणवत्ता नोंद',
      relatedTitle: 'संबंधित औद्योगिक घटक',
    },
  },
};
