#!/usr/bin/env tsx

/**
 * Quick script to clear profile cache for debugging
 * Run in browser console:
 * localStorage.removeItem('quiver_profile_cache');
 * location.reload();
 */

console.log('To clear profile cache, open browser console and run:');
console.log('');
console.log('localStorage.removeItem("quiver_profile_cache");');
console.log('location.reload();');
console.log('');
console.log('Then check for these log messages:');
console.log('- ✅ Profile loaded');
console.log('- ✅ Found home beach by ID');
console.log('- 🏠 [HomeScreen] Profile and location state');
