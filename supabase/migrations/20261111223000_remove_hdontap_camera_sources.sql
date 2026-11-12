BEGIN;

-- Match each captured field independently so newer replacements survive.
WITH captured(beach_id, camera_hash, thumbnail_hash) AS (
  VALUES
    ('80efa1c0-37a2-4879-819b-647ae3c3d749'::uuid, 'c7d36b3823739fa28482db6e0838b89a26edd4d0ae0e93bea8326e0365de9d8f', '9abaf5ce672ed6b3d0a4cadec62dfd61ecc4c8d8a0893d8c9b9d65314a49e36a'),
    ('c0977bcd-5475-4745-b4b8-0ca1e16a7faf'::uuid, '35ed15f24e1c3d9afe305dcca5f10971fcaccd10cc28af470976591003524322', '8bc12ae2210246dc2580d05d4a5c40f53e97b387d756856b0038a2bc7d3d39c2'),
    ('a1a7c2e8-2b3f-4b0d-9a6a-3b9d3b6b6c06'::uuid, '29fb9b7a06926b01ebb185721e57b9ca2046cb793e9aabf655491466c37a1e80', 'd3d2340a86d85b9063e8da7d978bc408e33a91affdfeaeeb38d6580c82bb5885'),
    ('b29821f9-c91a-486f-981b-7085c6d86b68'::uuid, 'e51eb06d86170eb6cd3a3d5ecc8e2b4aef874957e8ecc486f9c95f40939bb88d', '7e054b706301a87bd247c29775f7938a7768d713a6050495a8d91e4899b70723'),
    ('cc7c0837-257c-42c3-9d98-634911e73a6a'::uuid, '80c80ce62b46575570fb0e0650f2e39f3e52b0f77c8dfd91376c56e96fa75aba', 'dcb86d4e151067ced5dc03d3de287cb56aaf94caad7099358eaecaf1f2392a09'),
    ('5e72b79d-a12d-4cd3-8da4-b7b92069efbf'::uuid, '0cebe9947289f0a4861889e8de8f0fd534b0fc8cda018d383d99f22ab72380d6', 'd58cef6c58e45a4d9f1524fbfb760576f9f2952e1a6f91356e25a283803fed97'),
    ('7fc84dd8-abcc-4d7c-9ade-3d1500c1c24c'::uuid, '0cebe9947289f0a4861889e8de8f0fd534b0fc8cda018d383d99f22ab72380d6', 'd58cef6c58e45a4d9f1524fbfb760576f9f2952e1a6f91356e25a283803fed97'),
    ('a57ae4c8-7a27-4d3f-91d5-6229350fb888'::uuid, '47d29e39ecc8e03ac7dcaeb3a9b7fac31168ff20bf8d8c0feed1e37e6319c293', 'bf86079b95b2272f6d96d41451e1354fff834375ece5a5a76d191d20f2924ac4'),
    ('52879e4f-fc7f-4c02-a5e3-ea40b992ea80'::uuid, '814df2213723edee60f1059eb8f2c567e8a688dfa54b0656acd58f7e8279c46a', '8b7e3f452841ddea620e9b434e99d2ef706529878fc34601a68877c64223a9a1'),
    ('326941d7-6c39-4e82-b045-941b156f7897'::uuid, 'd0845b1830c936173dc349e917081e990a6a0abc516e268fbf869e94116897bf', '031bbeb6a46160bc0c5831f507c72bfaea62e7a9199d25706ef8d47545d63926'),
    ('110a87b2-cb2c-4bb7-8e83-b895fb2f4940'::uuid, 'f5181fd7c5e6626ea169e71b41187b611143b6d134a7bb3e16b737717d4ff46a', 'cde474049b0d6e7903f7990cb6718680b75fd753fc48bfc540929f2ef92f7479'),
    ('37ffa92a-d811-4791-afbb-b90a86dcdf49'::uuid, '2dd5eada716c9d2acb57eece2c18a8251226921fad35310a81de2b5e1739f204', 'a42d41cc1ccf7770b1db659dbeca5fa59412d05eba0d6d6a11315d17f4ab7cdb'),
    ('84d3468b-c1ec-46ad-8621-d8507e5f167a'::uuid, 'cb00e60dcbc1a01b82fd5fc63bd7667e952e6e0c634acff8c2d9a4723a125d03', '2d398dbc575ad1dabf9dbe5523c86554593be56879d6d6b214e755e1372b9b28'),
    ('d291411d-d331-4bf1-ad1a-302da3c69de0'::uuid, 'c5a9124fb276ec69d6656ea36e6d9bf2dbb18d7311a7d369b420b9bd9c18a03c', '6ed6960196b8ffe9ef117190389ef2deecf2aca71af62b1d778b8bd5fce2e0e3'),
    ('9841bdd0-e70f-4c10-bc54-135575006298'::uuid, '076759d5ed98c2a24321148d8edc19328272845277df8d7f3ec2be9003d466a9', '30a5ab50ddec0cc16d9868540731d45848e83a6a40c9bbbf7cbd030c511e9421'),
    ('005b0ba6-a2d9-4069-adbb-6571baffa698'::uuid, '620f00b9f9e8e4d7fcc4cadf0390bb1888d22cd42e26a5a4724087d103a43868', '9c9659b6f587701f771e7ef8db36ccd17a33ae2d78fb8e70f134892a6106e013'),
    ('afbd3aaf-099f-4147-b845-443590f0e148'::uuid, '620f00b9f9e8e4d7fcc4cadf0390bb1888d22cd42e26a5a4724087d103a43868', '9c9659b6f587701f771e7ef8db36ccd17a33ae2d78fb8e70f134892a6106e013'),
    ('abd3b0fa-6de6-480a-a6cc-c5c83143a707'::uuid, '076759d5ed98c2a24321148d8edc19328272845277df8d7f3ec2be9003d466a9', '30a5ab50ddec0cc16d9868540731d45848e83a6a40c9bbbf7cbd030c511e9421'),
    ('7a093b7e-2230-4bf1-abeb-9b31faa794d5'::uuid, 'fa448412206b0c25221e79f55d6ef4563aa70d492442d719135a571b04ba03d3', '112c91fe7951b65e5dddb3d7fc5033f802dcaa7ce28e725996249799d575b87b'),
    ('65809772-20bc-4009-b9b2-89c8ef3c4127'::uuid, '80c80ce62b46575570fb0e0650f2e39f3e52b0f77c8dfd91376c56e96fa75aba', 'dcb86d4e151067ced5dc03d3de287cb56aaf94caad7099358eaecaf1f2392a09'),
    ('badd7986-4609-421a-ab3d-81fcd8409a5b'::uuid, '05a47edd79a7a7408f6421a64b94520b31c04db503170f3f679d365ac50a1c6d', '1682f816f7521def0895e27e25938055bf6dca7b9ed96e7e9fa763933b3319b4'),
    ('13febd14-22c1-41a8-a78d-09c436194c9f'::uuid, 'ad247a3d016ab294fd79e0c0bf66ed2def4794f743c566a00a360b38142d1f56', '9c757352de6f0d1adf227ed7366fb8412e4c44d5751ec1e8ea4d85406ca5470f'),
    ('73bb4a48-3d53-42ba-bbd0-d89a7cf95711'::uuid, '918ebb85735d2bed9e126ff6345e0ede29db7f10a71fcd9f2ee4ae5aaa91634a', '5b2b40ad0e3816086e24a6dd442bbe56a63ed6b809017abe64fe587f2e420aef'),
    ('b1b49703-2376-407d-b1fb-9df06130ac1d'::uuid, '35ed15f24e1c3d9afe305dcca5f10971fcaccd10cc28af470976591003524322', '8bc12ae2210246dc2580d05d4a5c40f53e97b387d756856b0038a2bc7d3d39c2'),
    ('1fe4bf73-c425-48a5-899d-a7e8ee2d67e3'::uuid, '05a47edd79a7a7408f6421a64b94520b31c04db503170f3f679d365ac50a1c6d', '1682f816f7521def0895e27e25938055bf6dca7b9ed96e7e9fa763933b3319b4'),
    ('4bdbff9e-2c1f-4918-84a6-aed42fb6e42c'::uuid, '0cebe9947289f0a4861889e8de8f0fd534b0fc8cda018d383d99f22ab72380d6', 'd58cef6c58e45a4d9f1524fbfb760576f9f2952e1a6f91356e25a283803fed97'),
    ('91df193c-f2c8-4e6c-984e-b859bd741061'::uuid, '80c80ce62b46575570fb0e0650f2e39f3e52b0f77c8dfd91376c56e96fa75aba', 'dcb86d4e151067ced5dc03d3de287cb56aaf94caad7099358eaecaf1f2392a09'),
    ('11467f21-5a69-430d-9eb9-05a46cd39990'::uuid, 'a21ca95fb12825c61a6dfa9188759a7c00ad9395988b7a182d775ccb25d67ea1', '48d3f7ced21bea3fedc6aa8396ba12293c0eac25fa221ef4f34f056114b33f6c'),
    ('96fd7011-b894-4776-a68d-ff16fb1985d8'::uuid, 'a21ca95fb12825c61a6dfa9188759a7c00ad9395988b7a182d775ccb25d67ea1', '48d3f7ced21bea3fedc6aa8396ba12293c0eac25fa221ef4f34f056114b33f6c'),
    ('b4202dc4-e308-4dc2-9844-665413a75cb1'::uuid, 'f3ba3741965cb0e513443e60c14f99621ee8e6695abb154e6f4e4117425fddf2', NULL::text)
)
UPDATE public.beach_sources AS source
SET camera_url = CASE
      WHEN encode(sha256(convert_to(source.camera_url, 'UTF8')), 'hex') = captured.camera_hash
        THEN NULL ELSE source.camera_url END,
    thumbnail_url = CASE
      WHEN encode(sha256(convert_to(source.thumbnail_url, 'UTF8')), 'hex') = captured.thumbnail_hash
        THEN NULL ELSE source.thumbnail_url END
FROM captured
WHERE source.beach_id = captured.beach_id
  AND (
    encode(sha256(convert_to(source.camera_url, 'UTF8')), 'hex') = captured.camera_hash
    OR encode(sha256(convert_to(source.thumbnail_url, 'UTF8')), 'hex') = captured.thumbnail_hash
  );

-- Refuse direct or proxied provider URLs on future imports and row restores.
-- Adding a validated constraint also catches newly introduced matching rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.beach_sources'::regclass
      AND conname = 'beach_sources_no_hdontap'
  ) THEN
    ALTER TABLE public.beach_sources ADD CONSTRAINT beach_sources_no_hdontap CHECK (
      COALESCE(btrim(camera_url), '') !~* '^(https?:)?//([^/?#@]+@)?([a-z0-9_-]+[.])*hdontap[.]com[.]*([:/?#]|$)'
      AND COALESCE(btrim(camera_url), '') !~* '^(https?:)?//(www[.])?hanaleibayresort[.]com[.]*(:[0-9]+)?/live-web-camera/?([?#]|$)'
      AND COALESCE(btrim(thumbnail_url), '') !~* '^(https?:)?//([^/?#@]+@)?([a-z0-9_-]+[.])*hdontap[.]com[.]*([:/?#]|$)'
      AND COALESCE(camera_url, '') !~* '(/api/hls-proxy/|[?&]url=(https?(:|%3a)(/|%2f)(/|%2f)))([a-z0-9_-]+[.])*hdontap[.]com[.]*([:/?#&%]|$)'
      AND COALESCE(thumbnail_url, '') !~* '(/api/hls-proxy/|[?&]url=(https?(:|%3a)(/|%2f)(/|%2f)))([a-z0-9_-]+[.])*hdontap[.]com[.]*([:/?#&%]|$)'
    );
  END IF;
END
$$;

COMMIT;
