-- storage.objects RLS policies, extracted from production.
-- schema.sql covers the public schema only; without these RLS denies every
-- upload locally, which is indistinguishable from a bad storage path.
-- Tables are omitted deliberately — the local storage image creates them.
-- Regenerate with: yarn db:snapshot

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow updates to diorama videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to diorama videos" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete ML artifacts" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete beach photos" ON storage.objects;
DROP POLICY IF EXISTS "Service role can insert beach photos" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update beach photos" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload ML artifacts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own intel photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own session media" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own session media objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own session videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own intel photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own session media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own intel photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own session media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own session videos" ON storage.objects;
DROP POLICY IF EXISTS "community_photo_storage_service_role" ON storage.objects;

CREATE POLICY "Allow updates to diorama videos" ON "storage"."objects" FOR UPDATE USING (("bucket_id" = 'diorama-videos'::"text")) WITH CHECK (("bucket_id" = 'diorama-videos'::"text"));

CREATE POLICY "Allow uploads to diorama videos" ON "storage"."objects" FOR INSERT WITH CHECK (("bucket_id" = 'diorama-videos'::"text"));

CREATE POLICY "Service role can delete ML artifacts" ON "storage"."objects" FOR DELETE TO "service_role" USING (("bucket_id" = 'ml-artifacts'::"text"));

CREATE POLICY "Service role can delete beach photos" ON "storage"."objects" FOR DELETE TO "service_role" USING (("bucket_id" = 'beach-photos'::"text"));

CREATE POLICY "Service role can insert beach photos" ON "storage"."objects" FOR INSERT TO "service_role" WITH CHECK (("bucket_id" = 'beach-photos'::"text"));

CREATE POLICY "Service role can update beach photos" ON "storage"."objects" FOR UPDATE TO "service_role" USING (("bucket_id" = 'beach-photos'::"text"));

CREATE POLICY "Service role can upload ML artifacts" ON "storage"."objects" FOR INSERT TO "service_role" WITH CHECK (("bucket_id" = 'ml-artifacts'::"text"));

CREATE POLICY "Users can delete their own avatar" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'avatars'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Users can delete their own intel photos" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'intel-photos'::"text") AND (("storage"."foldername"("name"))[1] = 'intel-posts'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2])));

CREATE POLICY "Users can delete their own session media" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'session-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2])));

CREATE POLICY "Users can read their own session media objects" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'session-media'::"text") AND ((( SELECT "auth"."uid"() AS "uid"))::"text" = ("storage"."foldername"("name"))[2])));

CREATE POLICY "Users can read their own session videos" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'session-videos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2])));

CREATE POLICY "Users can update their own avatar" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'avatars'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Users can update their own intel photos" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'intel-photos'::"text") AND (("storage"."foldername"("name"))[1] = 'intel-posts'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2])));

CREATE POLICY "Users can update their own session media" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'session-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2])));

CREATE POLICY "Users can upload their own avatar" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'avatars'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Users can upload their own intel photos" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'intel-photos'::"text") AND (("storage"."foldername"("name"))[1] = 'intel-posts'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2])));

CREATE POLICY "Users can upload their own session media" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'session-media'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2]) AND (("storage"."foldername"("name"))[1] IS NOT NULL)));

CREATE POLICY "Users can upload their own session videos" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'session-videos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2])));

CREATE POLICY "community_photo_storage_service_role" ON "storage"."objects" TO "service_role" USING (("bucket_id" = 'community-spot-photos'::"text")) WITH CHECK (("bucket_id" = 'community-spot-photos'::"text"));
