# 📊 **Analytics Tracking Guide - Questions 3 & 4**

**Created**: October 19, 2025  
**Purpose**: Track user behavior to answer retention questions

---

## 🎯 **New Analytics Events Implemented**

### **Question 4: Tab Click Tracking**

**Event**: `home_tab_click`  
**Trigger**: When user clicks any tab on home screen  
**Data Captured**:
```javascript
{
  tab: "forecast" | "nearby" | "community",
  user_authenticated: boolean
}
```

**What This Tells Us**:
- % of users who click "Local Intel" tab
- Which tabs are most popular
- Authenticated vs. unauthenticated behavior

---

### **Question 3: Share Intel Button Tracking**

#### **Event 1**: `local_intel_tab_viewed`
**Trigger**: When Local Intel tab loads  
**Data Captured**:
```javascript
{
  user_authenticated: boolean,
  post_count: number  // How many intel posts were visible
}
```

**What This Tells Us**:
- How many users actually see the Local Intel tab
- Whether they see bot content or empty state

---

#### **Event 2**: `share_intel_button_clicked`
**Trigger**: When authenticated user clicks "+ Share Intel"  
**Data Captured**:
```javascript
{
  user_authenticated: true,
  view_mode: "feed" | "map"
}
```

**What This Tells Us**:
- How many authenticated users try to post intel
- Which view mode they're in when they click

---

#### **Event 3**: `share_intel_signin_prompt`
**Trigger**: When unauthenticated user clicks "+ Share Intel"  
**Data Captured**:
```javascript
{
  user_authenticated: false
}
```

**What This Tells Us**:
- How many users want to post but aren't signed in
- Potential conversion opportunity

---

### **Bonus: Engagement Tracking**

#### **Event**: `intel_post_created`
**Trigger**: When user successfully creates intel post  
**Data Captured**:
```javascript
{
  tag: "parking" | "hazard" | "crowd" | "conditions" | "access" | "other",
  has_photo: boolean
}
```

---

#### **Event**: `intel_post_confirmed`
**Trigger**: When user confirms/unconfirms an intel post  
**Data Captured**:
```javascript
{
  action: "confirm" | "unconfirm",
  post_id: string
}
```

---

#### **Event**: `plan_session_from_intel`
**Trigger**: When user clicks "Plan Session" from an intel post  
**Data Captured**:
```javascript
{
  post_id: string,
  post_tag: string,
  has_beach: boolean
}
```

---

## 📈 **How to Access This Data in Google Analytics**

### **In GA4 Dashboard:**

1. **Go to**: Reports → Engagement → Events
2. **Look for these event names**:
   - `home_tab_click`
   - `local_intel_tab_viewed`
   - `share_intel_button_clicked`
   - `share_intel_signin_prompt`
   - `intel_post_created`
   - `intel_post_confirmed`
   - `plan_session_from_intel`

### **Custom Report to Answer Questions 3 & 4:**

**Query 1: What % of users click "Local Intel" tab?**
```
Event: home_tab_click
Filter: tab = "community"
Metric: Unique Users / Total Active Users
```

**Query 2: Of those who view Local Intel, how many click Share Intel?**
```
Funnel:
1. local_intel_tab_viewed (100%)
2. share_intel_button_clicked (? %)

This shows conversion rate
```

**Query 3: How many unauthenticated users tried to post?**
```
Event: share_intel_signin_prompt
Metric: Event Count

Shows interest from non-users
```

---

## 🔍 **What to Look For (Next 7 Days)**

### **Hypothesis Testing:**

**Hypothesis 1**: "Users don't see the Local Intel tab"
- **Metric**: `home_tab_click` with `tab=community`
- **Expected**: <20% of users click it
- **If true**: Need to make tab more prominent

**Hypothesis 2**: "Users see the tab but don't click Share Intel"
- **Metric**: `local_intel_tab_viewed` vs. `share_intel_button_clicked`
- **Expected**: <5% conversion rate
- **If true**: Button isn't discoverable or compelling

**Hypothesis 3**: "Users want to post but aren't signed in"
- **Metric**: `share_intel_signin_prompt` count
- **Expected**: >10 events in 7 days
- **If true**: Auth gate is blocking engagement

---

## 📊 **Expected Baseline Metrics (93 Users)**

Based on your current stats:

### **Optimistic Scenario:**
- 50% click Local Intel tab = 46 users
- 10% click Share Intel = 4-5 clicks
- 2% actually post = 1-2 real posts

### **Realistic Scenario:**
- 20% click Local Intel tab = 18 users
- 5% click Share Intel = 1 click
- 0% actually post = 0 real posts

### **Pessimistic Scenario:**
- 10% click Local Intel tab = 9 users
- 0% click Share Intel = 0 clicks
- 0% post = 0 real posts

---

## 🎯 **Action Plan Based on Results**

### **If <20% click Local Intel tab:**
**Problem**: Tab discovery  
**Fix**: 
- Make "Local Intel" more prominent
- Add notification badge ("3 new intel posts!")
- Change tab order (put it first?)

### **If >20% view tab but <5% click Share Intel:**
**Problem**: Button visibility or motivation  
**Fix**:
- Make button more prominent
- Add empty state CTA: "Be the first to share!"
- Add examples/tooltips

### **If >5% click but 0% post:**
**Problem**: Form friction or confusion  
**Fix**:
- Simplify intel post form
- Add examples/templates
- Remove required fields

### **If >10 signin prompts but 0 signups:**
**Problem**: Auth friction  
**Fix**:
- Allow anonymous posts (with moderation)
- Simplify signup flow
- Show value before requiring auth

---

## 🚀 **Next Steps**

### **Today:**
1. ✅ Analytics tracking implemented
2. ⏳ Deploy to production
3. ⏳ Wait 7 days for data

### **In 7 Days:**
4. Export GA4 data for these events
5. Calculate conversion rates
6. Identify drop-off points
7. Create prioritized fix list

### **Sample GA4 Export Query:**
```sql
-- In GA4 BigQuery export
SELECT
  event_name,
  COUNT(DISTINCT user_pseudo_id) as unique_users,
  COUNT(*) as event_count,
  event_date
FROM `your-project.analytics_XXXXX.events_*`
WHERE event_name IN (
  'home_tab_click',
  'local_intel_tab_viewed',
  'share_intel_button_clicked',
  'share_intel_signin_prompt',
  'intel_post_created'
)
AND _TABLE_SUFFIX BETWEEN '20251019' AND '20251026'
GROUP BY event_name, event_date
ORDER BY event_date DESC, unique_users DESC
```

---

## 📝 **Summary: Questions Answered**

**Question 3**: "Do users see the + Share Intel button?"
- **Answer**: We can now track:
  - Who views Local Intel tab (`local_intel_tab_viewed`)
  - Who clicks Share Intel (`share_intel_button_clicked`)
  - Conversion rate between viewing and clicking

**Question 4**: "What % of users clicked Local Intel tab?"
- **Answer**: We can now track:
  - Total tab clicks by type (`home_tab_click`)
  - % distribution across all 3 tabs
  - Authenticated vs. unauthenticated behavior

---

**Status**: ✅ Tracking implemented, ready to collect data  
**Next Review**: October 26, 2025 (7 days of data)  
**Goal**: Identify the #1 blocker to user engagement with intel features

