export const launchCollege = {
  id: "kiet",
  name: "KIET Group of Institutions Delhi-NCR",
  domain: "kiet.edu"
} as const;

export const yearOptions = [1, 2, 3, 4, 5, 6] as const;
export const courseCatalog = {
  "B.Tech": {
    streams: [
      "Computer Science and Engineering",
      "Computer Science and Engineering - AI",
      "Computer Science and Engineering - AI & ML",
      "Computer Science and Engineering - Data Science",
      "Information Technology",
      "Electronics and Communication Engineering",
      "Electrical and Electronics Engineering",
      "Electrical Engineering",
      "Mechanical Engineering",
      "Civil Engineering"
    ],
    years: [1, 2, 3, 4]
  },
  "M.Tech": {
    streams: ["Computer Science and Engineering", "VLSI Design", "Power Systems", "Mechanical Engineering"],
    years: [1, 2]
  },
  BCA: {
    streams: ["General", "Data Science", "Artificial Intelligence"],
    years: [1, 2, 3]
  },
  MCA: {
    streams: ["General", "Data Science", "Artificial Intelligence"],
    years: [1, 2]
  },
  BBA: {
    streams: ["General", "Digital Business", "Entrepreneurship"],
    years: [1, 2, 3]
  },
  MBA: {
    streams: ["Finance", "Marketing", "Human Resources", "Business Analytics", "Operations"],
    years: [1, 2]
  },
  "B.Sc": {
    streams: ["Computer Science", "Physics", "Chemistry", "Mathematics", "Biotechnology"],
    years: [1, 2, 3]
  },
  "B.Pharm": {
    streams: ["General"],
    years: [1, 2, 3, 4]
  },
  "M.Pharm": {
    streams: ["Pharmaceutics", "Pharmacology", "Pharmaceutical Chemistry"],
    years: [1, 2]
  },
  Diploma: {
    streams: ["Computer Science", "Electrical Engineering", "Mechanical Engineering", "Civil Engineering"],
    years: [1, 2, 3]
  },
  "Applied Sciences": {
    streams: ["Physics", "Chemistry", "Mathematics", "Humanities"],
    years: [1, 2, 3, 4]
  },
  Other: {
    streams: ["General"],
    years: [1, 2, 3, 4, 5, 6]
  }
} as const;

export const courseOptions = Object.keys(courseCatalog) as Array<keyof typeof courseCatalog>;
export const defaultCourse = courseOptions[0];
export const defaultStream = courseCatalog[defaultCourse].streams[0];

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getEmailDomain(email: string) {
  return normalizeEmail(email).split("@")[1] ?? "";
}

export function isAllowedCollegeEmail(email: string) {
  return getEmailDomain(email) === launchCollege.domain;
}

export function getCollegeEmailMessage() {
  return `Use your @${launchCollege.domain} email address to continue.`;
}

export function getStreamOptions(course: string) {
  const options = courseCatalog[course as keyof typeof courseCatalog]?.streams ?? courseCatalog[defaultCourse].streams;
  return [...options] as string[];
}

export function getYearOptionsForCourse(course: string) {
  const options = courseCatalog[course as keyof typeof courseCatalog]?.years ?? yearOptions;
  return [...options] as number[];
}

export function inferCourseAndStream(profile: { course?: string | null; stream?: string | null; branch?: string | null }) {
  if (profile.course && profile.stream) {
    return {
      course: profile.course,
      stream: profile.stream
    };
  }

  const legacyBranch = profile.branch?.trim();
  if (!legacyBranch) {
    return {
      course: defaultCourse,
      stream: defaultStream
    };
  }

  if (courseCatalog["B.Tech"].streams.includes(legacyBranch as (typeof courseCatalog)["B.Tech"]["streams"][number])) {
    return {
      course: "B.Tech",
      stream: legacyBranch
    };
  }

  if (legacyBranch === "MBA") {
    return {
      course: "MBA",
      stream: "Finance"
    };
  }

  if (legacyBranch === "MCA") {
    return {
      course: "MCA",
      stream: "General"
    };
  }

  if (legacyBranch === "Pharmacy") {
    return {
      course: "B.Pharm",
      stream: "General"
    };
  }

  if (legacyBranch === "Applied Sciences") {
    return {
      course: "Applied Sciences",
      stream: "Physics"
    };
  }

  return {
    course: defaultCourse,
    stream: defaultStream
  };
}

export function splitDisplayName(displayName: string) {
  const normalized = displayName.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.toLowerCase() === "vyb explorer") {
    return {
      firstName: "",
      lastName: ""
    };
  }

  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName,
    lastName: rest.join(" ")
  };
}
