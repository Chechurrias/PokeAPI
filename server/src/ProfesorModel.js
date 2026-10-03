import mongoose from 'mongoose';

const ExperienceSchema = new mongoose.Schema(
  {
    company: String,
    role: String,
    period: String,
    description: String,
  },
  { _id: false }
);

const EducationSchema = new mongoose.Schema(
  {
    institution: String,
    degree: String,
    year: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  { linkedin: String, website: String },
  { _id: false }
);

const ProfesorSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    apellido: String,
    headline: String,
    Profesion: String,
    image: String,
    location: String,
    about: String,
    experience: [ExperienceSchema],
    education: [EducationSchema],
    skills: [String],
    contact: ContactSchema,
  },
  { collection: 'datos' }
);

export const Profesor = mongoose.model('Profesor', ProfesorSchema);
