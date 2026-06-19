const resumeData = {
  personalInfo: {
    name: "John Smith",
    email: "john.smith@example.com",
    phone: "+1 234 567 8901",
    location: "New York, USA",
    linkedin: "https://linkedin.com/in/johnsmith",
    github: "https://github.com/johnsmith"
  },

  summary:
    "Full Stack Developer with 3+ years of experience building scalable web applications using JavaScript, React, Node.js, and MongoDB. Passionate about creating efficient and user-friendly solutions.",

  skills: [
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "Express.js",
    "MongoDB",
    "MySQL",
    "Git",
    "Docker",
    "REST APIs"
  ],

  education: [
    {
      degree: "Bachelor of Technology in Computer Science",
      institution: "ABC University",
      location: "New York, USA",
      startDate: "2018",
      endDate: "2022",
      cgpa: "8.7/10"
    }
  ],

  experience: [
    {
      company: "Tech Solutions Inc.",
      position: "Full Stack Developer",
      startDate: "Jan 2023",
      endDate: "Present",
      responsibilities: [
        "Developed and maintained web applications using React and Node.js.",
        "Built RESTful APIs and integrated third-party services.",
        "Improved application performance by 30% through code optimization.",
        "Collaborated with cross-functional teams in Agile environments."
      ]
    },
    {
      company: "WebCraft Technologies",
      position: "Software Developer Intern",
      startDate: "Jun 2022",
      endDate: "Dec 2022",
      responsibilities: [
        "Assisted in developing frontend components using React.",
        "Fixed bugs and improved UI responsiveness.",
        "Participated in code reviews and testing."
      ]
    }
  ],

  projects: [
    {
      title: "E-Commerce Platform",
      description:
        "Built a full-stack e-commerce application with user authentication, product management, cart functionality, and payment integration.",
      technologies: ["React", "Node.js", "Express", "MongoDB"]
    },
    {
      title: "Task Management System",
      description:
        "Developed a collaborative task management application with real-time updates and team workspaces.",
      technologies: ["React", "Socket.io", "Node.js", "MongoDB"]
    }
  ],

  certifications: [
    {
      name: "AWS Certified Cloud Practitioner",
      issuer: "Amazon Web Services",
      year: "2024"
    },
    {
      name: "Meta Front-End Developer Professional Certificate",
      issuer: "Meta",
      year: "2023"
    }
  ],

  languages: [
    "English",
    "Spanish"
  ],

  achievements: [
    "Winner of University Hackathon 2021",
    "Solved 500+ coding problems on LeetCode"
  ]
};

function resume() {
  return `
John Doe
Email: john.doe@gmail.com
Phone: +91 9876543210
Location: Ahmedabad, Gujarat

SUMMARY
Full Stack Developer with 3 years of experience building scalable web applications using JavaScript, Node.js, Express, React, and MongoDB.

SKILLS
- JavaScript
- Node.js
- Express.js
- React.js
- MongoDB
- REST APIs
- Git & GitHub

EXPERIENCE
Software Developer | ABC Technologies
Jan 2023 - Present
- Developed REST APIs using Node.js and Express.
- Improved application performance by 30%.
- Collaborated with frontend and backend teams.

EDUCATION
Bachelor of Engineering in Computer Science
Gujarat Technological University
2022

PROJECTS
Job Portal Application
- Built a full-stack job portal using MERN stack.
- Implemented JWT authentication and role-based access control.
`;
}

function selfDescription() {
  return `
I am a passionate Full Stack Developer with strong problem-solving skills and hands-on experience in building modern web applications. I enjoy learning new technologies, working in collaborative environments, and creating efficient solutions to real-world problems. My strengths include backend development with Node.js and Express, frontend development with React, and database management using MongoDB. I am eager to contribute to innovative projects and continuously improve my technical expertise.
`;
}

function jobDescription() {
  return `
Job Title: Full Stack Developer

Company: TechNova Solutions

Responsibilities:
- Develop and maintain web applications using React and Node.js.
- Design and implement RESTful APIs.
- Work with MongoDB and SQL databases.
- Collaborate with designers and product managers.
- Write clean, maintainable, and well-documented code.

Requirements:
- Bachelor's degree in Computer Science or related field.
- 2+ years of experience in Full Stack Development.
- Strong knowledge of JavaScript, React, Node.js, and Express.
- Experience with MongoDB.
- Familiarity with Git and Agile methodologies.

Preferred Qualifications:
- Experience with cloud platforms (AWS, Azure, or GCP).
- Knowledge of Docker and CI/CD pipelines.
`;
}

// module.exports = resumeData;
module.exports = {
    resume, selfDescription, jobDescription
}