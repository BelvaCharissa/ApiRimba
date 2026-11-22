-- Supabase memberi EXECUTE bawaan ke anon untuk tiap fungsi baru (default privileges), sehingga
-- `revoke ... from public` di 0007 belum cukup. Fungsi staf, admin, dan profil hanya untuk pengguna
-- yang sudah masuk. (Fungsinya sendiri sudah menolak tamu; ini lapisan kedua.)
revoke execute on function staff_list_reports(integer) from anon;
revoke execute on function staff_review_report(uuid, text, text) from anon;
revoke execute on function staff_list_pledges(integer) from anon;
revoke execute on function staff_set_pledge(uuid, text, text) from anon;
revoke execute on function admin_list_users(integer) from anon;
revoke execute on function admin_set_role(uuid, text) from anon;
revoke execute on function update_my_profile(text) from anon;
