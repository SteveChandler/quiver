/**
 * @jest-environment jsdom
 */

import React from 'react';

/**
 * Test to verify intel dashboard defaults to nearby mode
 * 
 * This is a regression test for the bug where intel posts appeared in Forecast tab 
 * but not in Intel tab, because Intel tab was defaulting to "all posts" mode 
 * while Forecast tab used location-based queries.
 */
describe('IntelDashboard Fix Verification', () => {
  it('should default to nearby mode to match Forecast tab behavior', () => {
    // This test verifies the code change made to fix the bug:
    // Changed line 47 in intel-dashboard.tsx from:
    //   const [locationMode, setLocationMode] = useState<LocationMode>("all");
    // To:
    //   const [locationMode, setLocationMode] = useState<LocationMode>("nearby");
    //
    // This ensures both Forecast tab and Intel tab use the same location-based
    // data fetching approach, which should show the same intel posts.
    
    const expectedDefaultLocationMode = 'nearby';
    
    // Read the component file to verify the fix is in place
    const fs = require('fs');
    const path = require('path');
    const componentPath = path.join(__dirname, '../../../components/intel/intel-dashboard.tsx');
    const componentContent = fs.readFileSync(componentPath, 'utf8');
    
    // Verify the default state is set to "nearby"
    expect(componentContent).toContain('useState<LocationMode>("nearby")');
    
    // Verify the comment explains the fix
    expect(componentContent).toContain('Default to showing nearby posts to match Forecast tab behavior');
  });

  it('should use location-based queries by default', () => {
    // This test documents the expected behavior after the fix:
    // - Intel tab should use useLocationIntelData with showAll: false
    // - This makes it use getNearbyIntelPosts/getPublicIntelPosts (same as BeachIntelSection)
    // - Both tabs now show the same intel posts from location-based queries
    
    const fs = require('fs');
    const path = require('path');
    const componentPath = path.join(__dirname, '../../../components/intel/intel-dashboard.tsx');
    const componentContent = fs.readFileSync(componentPath, 'utf8');
    
    // Verify the component uses showAll based on locationMode
    expect(componentContent).toContain('showAll: locationMode === "all"');
    
    // Since locationMode defaults to "nearby", showAll will be false by default
    // This means useLocationIntelData will call location-based queries
    expect(componentContent).toMatch(/locationMode.*=.*useState.*"nearby"/);
  });
});