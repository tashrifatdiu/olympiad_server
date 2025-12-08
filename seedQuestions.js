require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('./models/Question');

const sampleQuestions = [
  {
    questionText: "What is the SI unit of electric current?",
    options: [
      { text: "Volt", optionId: "A" },
      { text: "Ampere", optionId: "B" },
      { text: "Ohm", optionId: "C" },
      { text: "Watt", optionId: "D" }
    ],
    correctAnswer: "B",
    subject: "Physics",
    difficulty: "Easy",
    marks: 1
  },
  {
    questionText: "What is the chemical formula of water?",
    options: [
      { text: "H2O", optionId: "A" },
      { text: "CO2", optionId: "B" },
      { text: "O2", optionId: "C" },
      { text: "H2SO4", optionId: "D" }
    ],
    correctAnswer: "A",
    subject: "Chemistry",
    difficulty: "Easy",
    marks: 1
  },
  {
    questionText: "What is the value of π (pi) approximately?",
    options: [
      { text: "2.14", optionId: "A" },
      { text: "3.14", optionId: "B" },
      { text: "4.14", optionId: "C" },
      { text: "5.14", optionId: "D" }
    ],
    correctAnswer: "B",
    subject: "Mathematics",
    difficulty: "Easy",
    marks: 1
  },
  {
    questionText: "What is the powerhouse of the cell?",
    options: [
      { text: "Nucleus", optionId: "A" },
      { text: "Ribosome", optionId: "B" },
      { text: "Mitochondria", optionId: "C" },
      { text: "Chloroplast", optionId: "D" }
    ],
    correctAnswer: "C",
    subject: "Biology",
    difficulty: "Easy",
    marks: 1
  },
  {
    questionText: "What is Newton's second law of motion?",
    options: [
      { text: "F = ma", optionId: "A" },
      { text: "E = mc²", optionId: "B" },
      { text: "V = IR", optionId: "C" },
      { text: "P = VI", optionId: "D" }
    ],
    correctAnswer: "A",
    subject: "Physics",
    difficulty: "Medium",
    marks: 1
  }
];

const generateQuestions = (baseQuestions, count) => {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const base = baseQuestions[i % baseQuestions.length];
    questions.push({
      ...base,
      questionText: `${base.questionText} (Question ${i + 1})`
    });
  }
  return questions;
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await Question.deleteMany({});
    console.log('Cleared existing questions');

    const questions = generateQuestions(sampleQuestions, 200);
    await Question.insertMany(questions);
    
    console.log(`Successfully seeded ${questions.length} questions`);
    
    const count = await Question.countDocuments();
    console.log(`Total questions in database: ${count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
