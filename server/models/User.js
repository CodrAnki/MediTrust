import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Never returned by default queries — services/userService.js opts
    // back in with .select('+passwordHash') only where it's needed
    // (login, which must compare it).
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },

    // --- Email verification (OTP) ------------------------------------------------
    // Deliberately NO schema default for emailVerified: Mongoose would apply it to
    // pre-existing documents on read and lock every legacy user out. A missing
    // value (legacy account) is treated as verified; only an explicit `false`
    // (a new, unconfirmed registration) blocks login. See services/userService.js
    // isEmailVerified().
    emailVerified: { type: Boolean },
    emailVerifiedAt: { type: Date },
    // bcrypt hash of the 6-digit code. The plaintext code is never stored or logged.
    emailVerificationOtpHash: { type: String, select: false },
    emailVerificationOtpExpiresAt: { type: Date },
    emailVerificationAttempts: { type: Number, default: 0 },
    emailVerificationLastSentAt: { type: Date },
  },
  { timestamps: true }
);

// NOTE: `email` already declares `unique: true` on the field above, which
// implicitly creates a unique index — an additional explicit
// `userSchema.index({ email: 1 }, { unique: true })` here was a duplicate
// of the same index and is what produced the
// "Duplicate schema index on {"email":1}" Mongoose warning at startup.

const User = mongoose.model('User', userSchema);

export default User;
