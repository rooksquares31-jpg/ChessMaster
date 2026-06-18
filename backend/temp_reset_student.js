const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
dotenv.config();

const UserSchema = new mongoose.Schema({
  email: String,
  password: { type: String, required: true }
}, { strict: false });

// Match the User model's pre-save middleware
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', UserSchema, 'users');

async function run() {
  const uri = process.env.MONGO_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected.');
  
  const student = await User.findOne({ email: 'student1@chess.com' });
  if (student) {
    student.password = 'Student123!';
    await student.save();
    console.log('Updated password for student1@chess.com to Student123!');
  } else {
    console.log('student1@chess.com not found.');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
