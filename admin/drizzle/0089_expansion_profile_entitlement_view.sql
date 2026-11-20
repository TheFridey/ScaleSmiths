-- Operation Intelligence B0 merge remediation (forward-only): public profile suspension on lapsed entitlement.
-- The public projection now also requires CURRENT entitlement: the qualification count must still meet the reward's milestone and no review flag may be open.
-- A revoked qualification or a refund under review suspends the page on the next request; history is untouched; restoring entitlement through a
-- founder decision restores the page (its wording was already approved and is an immutable version).
CREATE OR REPLACE VIEW expansion_public_partner_profiles WITH (security_barrier = true) AS
SELECT pub.slug, pub.display_name, pub.biography, pub.operating_area, pub.enquiry_mode, pub.published_at, pub.achievements,
  CASE WHEN pub.enquiry_mode = 'referral_code' THEN (SELECT c.code FROM expansion_referral_codes c WHERE c.partner_id = pub.partner_id ORDER BY c.created_at LIMIT 1) END AS referral_code,
  (SELECT r.recognition_date FROM expansion_recognitions r WHERE r.partner_id = pub.partner_id AND r.kind = 'founding_partner' AND r.status = 'approved') AS founding_recognition_date
FROM expansion_profile_publications pub
JOIN expansion_partners p ON p.id = pub.partner_id
JOIN admin_users u ON u.id = p.user_id
WHERE pub.status = 'live' AND u.active AND p.activated_at IS NOT NULL AND u.role::text = 'independent_partner'
  AND EXISTS (SELECT 1 FROM expansion_achievement_rewards r WHERE r.partner_id = pub.partner_id AND r.kind = 'webpage' AND r.status IN ('approved','fulfilment_pending','fulfilled')
              -- Inline, not a function call: the public role holds no EXECUTE and no table privilege, and the view reads these tables as its owner.
              AND (SELECT count(*) FROM expansion_client_qualifications q WHERE q.partner_id = pub.partner_id AND q.status = 'qualified') >= r.milestone_clients
              AND NOT EXISTS (SELECT 1 FROM expansion_qualification_flags f JOIN expansion_client_qualifications fq ON fq.id = f.qualification_id WHERE fq.partner_id = pub.partner_id AND f.status = 'open'));
