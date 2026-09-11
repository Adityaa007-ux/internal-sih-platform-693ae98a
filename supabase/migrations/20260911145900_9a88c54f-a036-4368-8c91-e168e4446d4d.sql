DROP POLICY IF EXISTS "read mentors" ON public.mentors;
CREATE POLICY "staff read mentors" ON public.mentors FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admins manage mentors" ON public.mentors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.institutions (official_name, short_name, institution_type, state, city, status)
SELECT v.official_name, v.short_name, v.institution_type, v.state, v.city, 'active'
FROM (VALUES
  ('Savitribai Phule Pune University','SPPU','university','Maharashtra','Pune'),
  ('College of Engineering Pune Technological University','COEP Tech','university','Maharashtra','Pune'),
  ('Indian Institute of Technology Bombay','IIT Bombay','institute','Maharashtra','Mumbai'),
  ('Indian Institute of Technology Delhi','IIT Delhi','institute','Delhi','New Delhi'),
  ('Indian Institute of Technology Madras','IIT Madras','institute','Tamil Nadu','Chennai'),
  ('Indian Institute of Technology Kanpur','IIT Kanpur','institute','Uttar Pradesh','Kanpur'),
  ('Indian Institute of Technology Kharagpur','IIT Kharagpur','institute','West Bengal','Kharagpur'),
  ('Indian Institute of Technology Roorkee','IIT Roorkee','institute','Uttarakhand','Roorkee'),
  ('Indian Institute of Technology Guwahati','IIT Guwahati','institute','Assam','Guwahati'),
  ('Indian Institute of Technology Hyderabad','IIT Hyderabad','institute','Telangana','Hyderabad'),
  ('National Institute of Technology Karnataka, Surathkal','NITK Surathkal','institute','Karnataka','Mangaluru'),
  ('National Institute of Technology Tiruchirappalli','NIT Trichy','institute','Tamil Nadu','Tiruchirappalli'),
  ('National Institute of Technology Warangal','NIT Warangal','institute','Telangana','Warangal'),
  ('Visvesvaraya National Institute of Technology, Nagpur','VNIT Nagpur','institute','Maharashtra','Nagpur'),
  ('Motilal Nehru National Institute of Technology Allahabad','MNNIT Allahabad','institute','Uttar Pradesh','Prayagraj'),
  ('Sardar Vallabhbhai National Institute of Technology, Surat','SVNIT Surat','institute','Gujarat','Surat'),
  ('Delhi Technological University','DTU','university','Delhi','New Delhi'),
  ('Netaji Subhas University of Technology','NSUT','university','Delhi','New Delhi'),
  ('Vellore Institute of Technology','VIT Vellore','university','Tamil Nadu','Vellore'),
  ('Birla Institute of Technology and Science, Pilani','BITS Pilani','institute','Rajasthan','Pilani'),
  ('Manipal Academy of Higher Education','MAHE Manipal','university','Karnataka','Manipal'),
  ('SRM Institute of Science and Technology','SRMIST','university','Tamil Nadu','Chennai'),
  ('Amrita Vishwa Vidyapeetham','Amrita','university','Tamil Nadu','Coimbatore'),
  ('Anna University','Anna University','university','Tamil Nadu','Chennai'),
  ('Jadavpur University','Jadavpur University','university','West Bengal','Kolkata'),
  ('Aligarh Muslim University','AMU','university','Uttar Pradesh','Aligarh'),
  ('Banaras Hindu University','BHU','university','Uttar Pradesh','Varanasi'),
  ('Jamia Millia Islamia','JMI','university','Delhi','New Delhi'),
  ('University of Mumbai','Mumbai University','university','Maharashtra','Mumbai'),
  ('Shivaji University, Kolhapur','Shivaji University','university','Maharashtra','Kolhapur'),
  ('Dr. Babasaheb Ambedkar Technological University','DBATU','university','Maharashtra','Lonere'),
  ('Visvesvaraya Technological University','VTU','university','Karnataka','Belagavi'),
  ('Gujarat Technological University','GTU','university','Gujarat','Ahmedabad'),
  ('Rajasthan Technical University','RTU','university','Rajasthan','Kota'),
  ('Dr. A.P.J. Abdul Kalam Technical University','AKTU','university','Uttar Pradesh','Lucknow'),
  ('Jawaharlal Nehru Technological University Hyderabad','JNTUH','university','Telangana','Hyderabad'),
  ('Osmania University','Osmania University','university','Telangana','Hyderabad'),
  ('Andhra University','Andhra University','university','Andhra Pradesh','Visakhapatnam'),
  ('Cochin University of Science and Technology','CUSAT','university','Kerala','Kochi'),
  ('APJ Abdul Kalam Technological University','KTU','university','Kerala','Thiruvananthapuram'),
  ('Panjab University','Panjab University','university','Chandigarh','Chandigarh'),
  ('Thapar Institute of Engineering and Technology','Thapar','institute','Punjab','Patiala'),
  ('Lovely Professional University','LPU','university','Punjab','Phagwara'),
  ('Chandigarh University','Chandigarh University','university','Punjab','Mohali'),
  ('Indian Institute of Information Technology Allahabad','IIIT Allahabad','institute','Uttar Pradesh','Prayagraj'),
  ('International Institute of Information Technology Hyderabad','IIIT Hyderabad','institute','Telangana','Hyderabad'),
  ('National Institute of Technology Rourkela','NIT Rourkela','institute','Odisha','Rourkela'),
  ('Kalinga Institute of Industrial Technology','KIIT','university','Odisha','Bhubaneswar'),
  ('Birla Institute of Technology, Mesra','BIT Mesra','institute','Jharkhand','Ranchi'),
  ('Maulana Azad National Institute of Technology, Bhopal','MANIT Bhopal','institute','Madhya Pradesh','Bhopal'),
  ('Rajiv Gandhi Proudyogiki Vishwavidyalaya','RGPV','university','Madhya Pradesh','Bhopal'),
  ('Chhattisgarh Swami Vivekanand Technical University','CSVTU','university','Chhattisgarh','Bhilai'),
  ('Gauhati University','Gauhati University','university','Assam','Guwahati'),
  ('Assam Engineering College','AEC','college','Assam','Guwahati'),
  ('Bengal Institute of Technology','BIT Kolkata','college','West Bengal','Kolkata'),
  ('Pune Institute of Computer Technology','PICT','college','Maharashtra','Pune'),
  ('Vishwakarma Institute of Technology, Pune','VIT Pune','college','Maharashtra','Pune'),
  ('MIT World Peace University','MIT-WPU','university','Maharashtra','Pune'),
  ('Sinhgad College of Engineering','SCOE Pune','college','Maharashtra','Pune'),
  ('Symbiosis Institute of Technology','SIT Pune','college','Maharashtra','Pune')
) AS v(official_name, short_name, institution_type, state, city)
WHERE NOT EXISTS (SELECT 1 FROM public.institutions i WHERE lower(i.official_name) = lower(v.official_name));

INSERT INTO public.campuses (institution_id, campus_name, campus_code, city, state, status)
SELECT i.id, 'Main Campus', 'MAIN', i.city, i.state, 'active'
FROM public.institutions i
WHERE NOT EXISTS (SELECT 1 FROM public.campuses c WHERE c.institution_id = i.id);