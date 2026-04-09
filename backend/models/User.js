const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['super_admin', 'admin', 'security_analyst', 'auditor', 'user'],
    default: 'user' 
  },
  permissions: [{
    type: String,
    enum: [
      'user:create', 'user:read', 'user:update', 'user:delete',
      'scan:create', 'scan:read', 'scan:update', 'scan:delete',
      'vulnerability:create', 'vulnerability:read', 'vulnerability:update', 'vulnerability:delete',
      'asset:create', 'asset:view', 'asset:edit', 'asset:delete',
      'dashboard:read', 'system:config', 'system:monitor', 'system:backup'
    ]
  }],
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Virtual for checking if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to add permissions based on role
userSchema.methods.addRolePermissions = function() {
  const rolePermissions = {
    super_admin: [
      'user:create', 'user:read', 'user:update', 'user:delete',
      'scan:create', 'scan:read', 'scan:update', 'scan:delete',
      'vulnerability:create', 'vulnerability:read', 'vulnerability:update', 'vulnerability:delete',
      'asset:create', 'asset:view', 'asset:edit', 'asset:delete',
      'dashboard:read', 'system:config', 'system:monitor', 'system:backup'
    ],
    admin: [
      'user:create', 'user:read', 'user:update',
      'scan:create', 'scan:read', 'scan:update', 'scan:delete',
      'vulnerability:create', 'vulnerability:read', 'vulnerability:update', 'vulnerability:delete',
      'asset:create', 'asset:view', 'asset:edit', 'asset:delete',
      'dashboard:read', 'system:monitor'
    ],
    security_analyst: [
      'scan:create', 'scan:read', 'scan:update',
      'vulnerability:read', 'vulnerability:update',
      'asset:view', 'asset:edit',
      'dashboard:read'
    ],
    auditor: [
      'scan:read', 'vulnerability:read', 'asset:view',
      'dashboard:read'
    ],
    user: [
      'scan:read', 'vulnerability:read', 'asset:view', 'dashboard:read'
    ]
  };

  this.permissions = rolePermissions[this.role] || [];
  return this.save();
};

// Pre-save middleware to automatically assign permissions
userSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('role')) {
    this.addRolePermissions();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
