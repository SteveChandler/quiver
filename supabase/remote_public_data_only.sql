SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: badge_definitions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: beaches; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: beach_forecast_accuracy; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: beach_recommendation_calibration; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: beach_reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: beach_review_likes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: boards; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buoys; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: enhanced_forecasts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: favorite_beaches; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: intel_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: intel_post_confirmations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: marine_forecasts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: session_forecast_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: session_invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: session_likes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: supabase_admin
--



--
-- Data for Name: spot_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sun_times; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tide_forecasts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_badges; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_follows; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_xp; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: xp_events; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1602, true);


--
-- PostgreSQL database dump complete
--

RESET ALL;
