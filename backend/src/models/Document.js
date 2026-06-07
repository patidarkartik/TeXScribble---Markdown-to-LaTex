import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Untitled Document'
    },
    content: {
      type: String,
      default: ''
    },
    latexCode: {
      type: String,
      default: ''
    },
    pdfData: {
      type: Buffer,
      default: null
    },
    hasPdf: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Document', DocumentSchema);
