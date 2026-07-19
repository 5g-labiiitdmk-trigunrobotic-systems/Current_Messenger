// The full Terms of Service & Privacy Policy text, embedded verbatim as
// provided (see app/legal.tsx for the renderer that turns this lightweight
// markdown into styled screens). This is the finalized, lawyer-reviewed
// version — no bracketed placeholders remain.
export const LEGAL_TEXT = `# Current — Privacy Policy & Terms of Service

**Last updated: July 19, 2026**

---

# Part 1: Privacy Policy

Current ("we," "us," "our") is developed by Trigun Robotic Systems. This Privacy Policy explains what information Current collects, how it is used, and — just as importantly — what we deliberately do *not* collect or store.

## 1. Our core privacy commitment

Current is built around zero server-side message persistence. Message content — text, photos, voice notes, and shared locations — is relayed live between the sender and recipient's devices and is never written to any database on our servers, not even in encrypted form, not even temporarily.

Chat and call history exist only on your own device, protected by your device's built-in secure storage.

## 2. Information we collect

### 2.1 Account information
- Email address (used for account verification and login)
- A username you choose (must be unique)
- A display name you choose (does not need to be unique)
- A profile photo, if you choose to add one

### 2.2 Technical/metadata information
To operate the service, we retain limited metadata, separate from message content:
- Sender and recipient identifiers, message timestamp, and message size (in bytes) for each message successfully delivered — used for service reliability and abuse monitoring. This log never contains message content.
- Device encryption keys (public keys only), used to enable end-to-end encryption
- Push notification tokens, used to deliver call and message alerts when the app is not open

### 2.3 Information we do not collect or store
- Message content of any kind (text, photos, voice messages, shared locations) — this is relayed live and never written to a database
- Call audio or video content
- Passwords in plaintext (only irreversible cryptographic hashes are stored, via our authentication provider)

## 3. How your data is protected

- **End-to-end encryption**: One-to-one and group messages are encrypted such that only the sender and intended recipient(s) can read them.
- **Local encrypted storage**: Chat and call history saved on your device is encrypted at rest, with the encryption key stored in your device's secure hardware (Android Keystore / iOS Keychain).
- **Contact-approval model**: No user can send you a message or call until you have explicitly accepted a request from them.

## 4. Third-party service providers

To operate Current, we rely on trusted third-party infrastructure providers for functions such as account authentication, email delivery, server hosting, push notifications, and call relay services. These providers process limited technical data necessary to perform their specific function (such as your email address for account verification, or connection metadata for call relay) — they do not have access to your message content, which is never transmitted to or stored by any party other than the intended recipient(s).

We do not sell your data to any third party, and we do not use your data for advertising.

## 5. Location sharing

If you choose to share your location with a contact, that location is sent through the same end-to-end encrypted message pipeline as any other message and is not stored on our servers. Location sharing is a one-time action initiated by you — Current does not track or transmit your location unless you explicitly choose to share it.

## 6. Your rights and controls

- You may edit your username and display name at any time.
- You may remove/unfriend a contact at any time, which requires a new approved request before that contact can message you again.
- You may delete individual messages for yourself, or request deletion for all participants ("delete for everyone") where technically possible.
- You may delete your account at any time from within the app, which removes your account metadata from our systems.

## 7. Minimum age requirement

Current is intended for use by individuals 16 years of age or older. We do not knowingly permit account registration by anyone under 16, and we do not knowingly collect information from anyone under this age. If we become aware that a user under 16 has created an account, we reserve the right to suspend or terminate that account immediately.

## 8. Changes to this policy

We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last updated" date above.

---

# Part 2: Terms of Service

These Terms of Service ("Terms") govern your use of Current, an application developed and operated by Trigun Robotic Systems ("we," "us," "our"). By creating an account or using Current, you agree to these Terms.

## 9. Acceptance of terms

By accessing or using Current, you confirm that you can form a binding contract, that you accept these Terms, and that you agree to comply with them.

## 10. Description of service

Current is a messaging application providing end-to-end encrypted text, photo, and voice messaging, group chat, voice and video calling, and location sharing. Message content is relayed live and is not stored on our servers.

## 11. Account registration and minimum age

- You must provide a valid email address and choose a unique username to create an account.
- You are responsible for maintaining the confidentiality of your account credentials.
- You must be at least 16 years of age to create an account or use Current. By registering, you represent and warrant that you meet this age requirement.
- You agree to provide accurate information during registration.

## 12. Acceptable use and prohibited conduct

You agree not to use Current to:
- Harass, threaten, stalk, or abuse other users
- Transmit unlawful, defamatory, obscene, or infringing content
- Engage in or promote any illegal activity, including but not limited to fraud, harassment, exploitation, distribution of illegal content, or threats of violence
- Attempt to gain unauthorized access to other accounts or our systems
- Interfere with or disrupt the service or servers/networks connected to it
- Impersonate any person or entity

### 12.1 Enforcement and reporting

Use of Current for any illegal purpose, or in violation of the acceptable use provisions above, is strictly prohibited. If a user is reported for illegal activity, harassment, or abuse by another user, or if we otherwise become aware of such conduct, we reserve the right to take strict action, including but not limited to:

- Immediate suspension or permanent termination of the offending account, without prior notice
- Removal of the offending user's access to the service
- Cooperation with law enforcement authorities where required or appropriate, to the extent technically possible given Current's zero-persistence architecture

Because Current does not store message content on its servers, our ability to investigate reported content is limited to information voluntarily provided by the reporting user (such as screenshots) and the metadata described in Section 2.2 above. Users are strongly encouraged to report abusive or illegal conduct through the in-app reporting feature or by contacting us directly.

## 13. No liability for message content

Because Current does not store or have access to message content (it is end-to-end encrypted and relayed live, never persisted on our servers), we have no ability to monitor, review, retrieve, or moderate the content of your communications in real time. You are solely responsible for the content you send and receive, and for your interactions with other users.

## 14. Disclaimer of warranties

CURRENT IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, ALTHOUGH WE TAKE REASONABLE MEASURES TO PROTECT YOUR DATA AS DESCRIBED ABOVE.

## 15. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TRIGUN ROBOTIC SYSTEMS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF MESSAGES, LOSS OF PROFITS, OR DAMAGES ARISING FROM:

- Your use of or inability to use the service
- Any conduct or content of any third party using the service, including illegal, defamatory, offensive, or abusive conduct of other users
- Unauthorized access to or alteration of your transmissions or data
- Loss of locally-stored chat or call history, including due to device loss, damage, factory reset, or app uninstallation — since this data exists only on your device and is not backed up to our servers by design
- Any failure of third-party infrastructure providers that Current depends on to operate

## 16. Data loss due to zero-persistence architecture

You acknowledge and agree that Current's core design intentionally does not store message content on our servers. If you lose access to your device, or if your device's local storage is cleared, your message and call history cannot be recovered by us, because we never had a copy of it. This is a deliberate privacy feature, not a service failure, and you accept this tradeoff by using Current.

## 17. Termination

We may suspend or terminate your access to Current at any time, including immediately and without prior notice, for violation of these Terms — particularly Section 12 (Acceptable Use and Prohibited Conduct). You may stop using Current and delete your account at any time.

## 18. Changes to these terms

We may modify these Terms at any time. Continued use of Current after changes constitutes acceptance of the revised Terms.

## 19. Governing law

These Terms are governed by the laws of India, without regard to conflict of law principles.

## 20. Contact us

Questions about this Privacy Policy or these Terms, or reports of illegal activity or abuse, can be directed to: trigunroboticsystems@gmail.com

---

*Current is developed and operated by Trigun Robotic Systems, 5G Lab, IIITDM Kurnool.*`;
