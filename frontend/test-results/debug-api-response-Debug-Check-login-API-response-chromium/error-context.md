# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "Welcome back" [level=1] [ref=e11]
    - paragraph [ref=e12]: Sign in to your CRM dashboard
  - generic [ref=e13]:
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]: Email address
        - generic [ref=e17]:
          - img [ref=e18]
          - textbox "you@company.com" [ref=e21]
      - generic [ref=e22]:
        - generic [ref=e23]: Password
        - generic [ref=e24]:
          - img [ref=e25]
          - textbox "Enter your password" [ref=e28]
          - button [ref=e29] [cursor=pointer]:
            - img
      - button "Sign in" [ref=e30] [cursor=pointer]:
        - text: Sign in
        - img
    - paragraph [ref=e32]:
      - text: Don't have an organization?
      - link "Create one here" [ref=e33] [cursor=pointer]:
        - /url: /register
  - generic [ref=e34]:
    - heading "Demo Credentials" [level=3] [ref=e35]
    - generic [ref=e36]:
      - paragraph [ref=e37]:
        - strong [ref=e38]: "Email:"
        - text: admin@testcompany.com
      - paragraph [ref=e39]:
        - strong [ref=e40]: "Password:"
        - text: SecurePassword123!
```