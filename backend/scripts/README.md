# Database Seeding Scripts

## Admin Account Setup

This directory contains scripts to create the default administrator account for the vulnerability management system.

### Default Admin Credentials
- **Email:** admin@camtel.cm
- **Password:** Admin@123!
- **Role:** admin

## Usage

### Development Environment
```bash
npm run seed-admin
```

### Production Environment
```bash
npm run seed-admin:prod
```

## Scripts

### seedAdmin.js
- Basic admin account creation
- Suitable for development environments
- Creates admin with auto-assigned permissions based on role
- Uses updated User schema with `name` field

### seedAdminProduction.js
- Production-ready admin account creation
- Includes additional production settings:
  - Email verified flag set to true
  - Last login timestamp
  - Enhanced logging and error handling
  - Security warnings about password change
  - Auto-assigned permissions based on admin role
  - Uses modern MongoDB connection (no deprecated options)

## Admin Permissions

The admin account is created with the following permissions:

### User Management
- `user:create` - Create new users
- `user:read` - View user information
- `user:update` - Update user details
- `user:delete` - Delete users

### Asset Management
- `asset:create` - Create assets
- `asset:read` - View assets
- `asset:edit` - Edit assets
- `asset:delete` - Delete assets

### System Administration
- `system:config` - System configuration
- `system:monitor` - System monitoring
- `system:backup` - System backup operations

### Vulnerability Management
- `vulnerability:create` - Create vulnerability records
- `vulnerability:read` - View vulnerabilities
- `vulnerability:update` - Update vulnerabilities
- `vulnerability:delete` - Delete vulnerabilities

### Scan Management
- `scan:create` - Create scans
- `scan:read` - View scan results
- `scan:update` - Update scans
- `scan:delete` - Delete scans

## Security Notes

1. **Change Default Password**: Always change the default password after first login
2. **Environment Variables**: Consider using environment variables for production credentials
3. **Database Security**: Ensure MongoDB is properly secured in production
4. **Access Control**: Implement proper IP whitelisting for admin access

## Production Deployment

For production deployment:

1. Run the production seed script:
   ```bash
   npm run seed-admin:prod
   ```

2. Change the default password immediately after first login

3. Configure additional security measures:
   - Enable two-factor authentication
   - Set up IP whitelisting
   - Configure audit logging

## Troubleshooting

### Admin Already Exists
If the admin account already exists, the script will display a message and exit without making changes.

### Database Connection Issues
Ensure:
- MongoDB is running
- Database URI in config is correct
- Network connectivity to database

### Permission Issues
Ensure the Node.js process has:
- Read/write access to the database
- File system permissions for script execution

## Additional Scripts

You can create additional seeding scripts for:
- Default asset categories
- Common vulnerability templates
- Default scan configurations
- Test data for development
