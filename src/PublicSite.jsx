import { useEffect, useState } from 'react'
import logo from './assets/logo.jpg'
import './PublicSite.css'

const services = [
  {
    id: 'personal-care',
    number: '01',
    title: 'Personal care',
    summary: 'Respectful, unhurried help with daily routines, hygiene, grooming, and getting dressed.',
    image: 'photo-1584515933487-779824d29309',
    imageAlt: 'Caregiver offering a helping hand',
    details: [
      { heading: 'Daily support', tasks: ['Assist with toileting, handwashing, bathing, and personal hygiene while protecting privacy and dignity.', 'Support oral care, hair care, grooming, skin care, and dressing with approved products.', 'Prepare clean clothes, pajamas, footwear, and personal items for the day or evening.', 'Encourage each person to do what they comfortably can, offering help based on their preferences and care plan.'] },
    ],
  },
  {
    id: 'mobility',
    number: '02',
    title: 'Mobility & safety',
    summary: 'Steady assistance at home, attentive supervision, and supported movement at each person’s pace.',
    image: 'photo-1559234938-b60fff04894d',
    imageAlt: 'Older adults walking safely outdoors',
    details: [
      { heading: 'Safe movement', tasks: ['Assist with getting in and out of bed, standing, sitting, walking, and moving around the home.', 'Stay nearby during meals, exercise, walking, and activities to help reduce fall risks.', 'Accompany approved exercise and help use equipment identified in the care plan.', 'Check readiness for activity, allow time for rest and hydration, and keep common walking areas clear.', 'Offer calm supervision and redirection when someone feels confused or disoriented.'] },
    ],
  },
  {
    id: 'meals',
    number: '03',
    title: 'Meals & hydration',
    summary: 'Thoughtful meal preparation, comfortable mealtimes, and encouragement to eat and drink.',
    image: 'photo-1547592180-85f173990554',
    imageAlt: 'Fresh meal prepared for the table',
    details: [
      { heading: 'Meal support', tasks: ['Prepare and serve meals, snacks, shakes, and drinks according to dietary guidance and personal preferences.', 'Make food manageable to eat and provide mealtime supervision or assistance as needed.', 'Encourage hydration and allow enough time for comfortable meals and rest around activities.', 'Clean hands and dining surfaces after meals; store prepared food safely.', 'Notice and report meaningful changes in appetite, eating, or fluid intake.'] },
    ],
  },
  {
    id: 'medication',
    number: '04',
    title: 'Medication & wellbeing',
    summary: 'Reminders and assistance only as authorized, alongside careful observation and clear handoffs.',
    image: 'photo-1576091160399-112ba8d25d1d',
    imageAlt: 'Care professional providing health support',
    details: [
      { heading: 'Authorized assistance', tasks: ['Give medication reminders and provide assistance only when authorized by the care plan and applicable instructions.', 'Prepare approved drinks or supplies for medication routines; organize containers only when permitted.', 'Observe comfort, pain, skin, behavior, appetite, hydration, mobility, and general condition.', 'Record relevant observations, report concerns to the manager, and share important updates with the next caregiver.', 'Weigh the person when requested.'] },
    ],
  },
  {
    id: 'companionship',
    number: '05',
    title: 'Companionship & activities',
    summary: 'Conversation, reassurance, familiar routines, and enjoyable activities chosen together.',
    image: 'photo-1559234938-b60fff04894d',
    imageAlt: 'Older adults walking together outdoors',
    details: [
      { heading: 'Meaningful time', tasks: ['Offer conversation, companionship, reassurance, and emotional support.', 'Enjoy puzzles, coloring, drawing, television, movies, music, dancing, or walks together.', 'Offer fresh air and social interaction outdoors when conditions allow.', 'Respect each person’s choices, energy, mood, and daily routine.'] },
    ],
  },
  {
    id: 'outings',
    number: '06',
    title: 'Outings & appointments',
    summary: 'Preparation and steady support for approved appointments, church, meals out, and visits.',
    image: 'photo-1559234938-b60fff04894d',
    imageAlt: 'Older adults walking together outdoors',
    details: [
      { heading: 'Before and during', tasks: ['Help with personal care, toileting, grooming, and clothing before an approved outing.', 'Pack care-plan-approved medications, clothing, and personal items that may be needed.', 'Assist with vehicle transfers and check that the seat belt is secured.', 'Accompany the person and support mobility, bathroom needs, meals, and authorized medication assistance.', 'Share relevant observations with the manager after returning.'] },
    ],
  },
  {
    id: 'overnight',
    number: '07',
    title: 'Bedtime & overnight',
    summary: 'A settled evening routine, scheduled safety checks, and a nearby response through the night.',
    image: 'photo-1584515933487-779824d29309',
    imageAlt: 'Caregiver offering a reassuring hand',
    details: [
      { heading: 'Evening and overnight', tasks: ['Assist with toileting, hygiene, changing clothes, and the individual bedtime routine.', 'Prepare the sleeping area, check for hazards, and help the person settle comfortably.', 'Complete safety checks as scheduled and remain available during overnight shifts.', 'Respond to requests for water, bathroom assistance, reassurance, or help returning to bed.', 'Use calm reassurance and redirection if confusion occurs overnight.'] },
    ],
  },
  {
    id: 'household',
    number: '08',
    title: 'Household support',
    summary: 'Practical help with the shared home, always balanced with the people’s supervision needs.',
    image: 'photo-1581578731548-c64695cc6952',
    imageAlt: 'A clean and organized home interior',
    details: [
      { heading: 'Kitchen and food storage', tasks: ['Prepare meals and beverages; wash, dry, and put away dishes and cookware.', 'Clean food-preparation and dining surfaces; store groceries safely and check for expired food.', 'Track household and personal-care supplies, prepare shopping lists, and complete authorized purchases.'] },
      { heading: 'Cleaning and laundry', tasks: ['Clean and organize the rooms and shared areas used during the shift.', 'Sanitize bathroom surfaces and bathing equipment, dry floors, remove waste, and restock basic supplies.', 'Wash, dry, fold, and put away clothing and linens; make beds and change bedding as scheduled.'] },
      { heading: 'Home safety', tasks: ['Manage household trash and complete assigned routine household tasks.', 'Turn off unnecessary lights and appliances, check running water, and secure appropriate doors.', 'Report maintenance issues, damaged items, supply shortages, and safety hazards.', 'Maintain appropriate supervision while completing household responsibilities.'] },
    ],
  },
]

const photos = [
  { id: 'photo-1576091160399-112ba8d25d1d', alt: 'Care professional offering health support', label: 'Attentive support' },
  { id: 'photo-1584515933487-779824d29309', alt: 'Caregiver offering a reassuring hand', label: 'A helping hand' },
  { id: 'photo-1559234938-b60fff04894d', alt: 'Older adults walking together outdoors', label: 'Time outdoors' },
]

function photoUrl(id, width = 1000) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`
}

export default function PublicSite() {
  const [activeService, setActiveService] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [formNote, setFormNote] = useState('')

  useEffect(() => {
    document.title = 'Angels at Home | Care and companionship'
    if (!activeService) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && setActiveService(null)
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [activeService])

  return (
    <div className="public-site">
      <header className="public-header">
        <div className="header-inner">
          <a className="public-brand" href="#home">Angels at Home LLC</a>
          <nav className={`public-nav${menuOpen ? ' open' : ''}`} aria-label="Main navigation">
            <a href="#about" onClick={() => setMenuOpen(false)}>Who We Are</a>
            <a href="#services" onClick={() => setMenuOpen(false)}>What We Do</a>
            <a href="#why-us" onClick={() => setMenuOpen(false)}>Why Choose Us</a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
            <a className="employee-link" href="/employee-login">Staff Login</a>
          </nav>
          <button className="nav-toggle" type="button" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main>
        <section className="public-hero" id="home">
          <div className="hero-copy">
            <img className="hero-logo" src={logo} alt="Angels at Home, home care assistance" />
            <p className="eyebrow">BIRMINGHAM, AL &amp; SURROUNDING AREAS</p>
            <h1>Compassionate Home Care You Can Trust</h1>
            <p className="hero-description">Angels at Home helps your loved ones live safely, comfortably, and with dignity, right where they belong: at home.</p>
            <div className="hero-actions">
              <a className="button-primary" href="#contact">Request a Consultation</a>
              <a className="button-text" href="#services">Our Services</a>
            </div>
          </div>
          <div className="hero-image-frame">
            <img src={photoUrl('photo-1584515933487-779824d29309', 1500)} alt="Caregiver offering a reassuring hand" fetchPriority="high" />
            <div className="hero-card">
              <div className="hero-card-icon" aria-hidden="true">💙</div>
              <p><strong>Trusted, screened caregivers</strong><br />Personalized care plans for every family.</p>
            </div>
          </div>
          <div className="hero-index" aria-hidden="true">AH / CARE</div>
        </section>

        <section className="about-section" id="about">
          <div className="about-inner">
            <div className="about-copy">
              <p className="eyebrow">Who We Are</p>
              <h2>A Family-Focused Home Care Agency</h2>
              <p>Angels at Home was founded on a simple belief: everyone deserves to age and heal in the comfort of their own home, surrounded by the people and things they love. Our caregivers are more than helpers; they become trusted companions who treat every client with kindness and respect.</p>
              <p>We work closely with each family to build a care plan tailored to their needs, from meals and light housekeeping to personal care and companionship.</p>
              <ul className="about-points">
                <li>Screened, trained, and compassionate caregivers</li>
                <li>Personalized care plans built around your family</li>
                <li>Clear, ongoing communication with families</li>
              </ul>
            </div>
            <div className="about-visual">
              <img src={photoUrl('photo-1559234938-b60fff04894d', 900)} alt="Older adults walking together outdoors" loading="lazy" />
              <h3>Care where it matters most: home</h3>
            </div>
          </div>
        </section>

        <section className="services-section" id="services">
          <div className="section-heading">
            <div><p className="eyebrow">THE SUPPORT THAT MAKES A DAY</p><h2>Care, in all its forms.</h2></div>
            <p>Explore the areas of support. Every task is guided by each person’s care plan, preferences, and needs that day.</p>
          </div>
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.id}>
                <div className="service-image">
                  <img src={photoUrl(service.image, 800)} alt={service.imageAlt} loading="lazy" />
                  <span className="service-number">{service.number}</span>
                </div>
                <div className="service-card-copy">
                  <div><h3>{service.title}</h3><p>{service.summary}</p></div>
                  <button type="button" className="detail-link" onClick={() => setActiveService(service)} aria-label={`More details about ${service.title}`}>
                    More details <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="photo-strip" aria-label="Moments of care">
          <div className="photo-tiles">
            {photos.map((photo, index) => (
              <figure className={`photo-tile photo-tile-${index + 1}`} key={photo.id}>
                <img src={photoUrl(photo.id, 900)} alt={photo.alt} loading="lazy" />
                <figcaption>{photo.label}</figcaption>
              </figure>
            ))}
          </div>
          <p className="photo-note">Illustrative stock photography from Unsplash. Images do not depict Angels at Home clients or employees.</p>
        </section>

        <section className="why-section" id="why-us">
          <div className="container">
            <p className="eyebrow center">Why Choose Us</p>
            <h2 className="center">Care That Feels Like Family</h2>
            <div className="why-grid">
              {[
                ['✅', 'Screened & Trained', 'Every caregiver is carefully vetted and prepared to provide safe, attentive care.'],
                ['📋', 'Personalized Plans', 'We build support around your loved one’s needs, preferences, and routines.'],
                ['🕒', 'Flexible Scheduling', 'From a few hours a week to ongoing support, care can fit your schedule.'],
                ['💬', 'Open Communication', 'We keep families informed and involved along the way.'],
              ].map(([icon, title, description]) => (
                <article className="why-item" key={title}>
                  <span className="why-icon" aria-hidden="true">{icon}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-inner">
            <div className="contact-info">
              <img className="contact-photo" src={photoUrl('photo-1576091160399-112ba8d25d1d', 900)} alt="Care professional providing attentive support" loading="lazy" />
              <p className="eyebrow">Contact Us</p>
              <h2>Let’s Talk About Your Family’s Needs</h2>
              <p>Reach out today for a no-pressure conversation about how Angels at Home can help.</p>
              <ul className="contact-list">
                <li><span aria-hidden="true">✉</span><a href="mailto:angelsathomeal@gmail.com">angelsathomeal@gmail.com</a></li>
                <li><span aria-hidden="true">⌖</span>Serving Birmingham, AL &amp; surrounding areas</li>
              </ul>
            </div>
            <form className="contact-form" onSubmit={async (event) => {
              event.preventDefault()
              const form = event.currentTarget
              const values = Object.fromEntries(new FormData(form).entries())
              const submitButton = form.querySelector('[type="submit"]')
              submitButton.disabled = true
              setFormNote('Sending your message...')
              try {
                const response = await fetch('/api/v1/contact/inquiry', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                  body: JSON.stringify(values)
                })
                const result = await response.json()
                if (!response.ok || result.success !== true) throw new Error('Unable to send your message. Please try again or email angelsathomeal@gmail.com.')
                setFormNote('Message sent. Thank you for contacting us.')
                form.reset()
              } catch (error) {
                setFormNote(error.message || 'Unable to send your message. Please try again or email angelsathomeal@gmail.com.')
              } finally {
                submitButton.disabled = false
              }
            }}>
              <label>Name<input type="text" name="name" required /></label>
              <label>Email<input type="email" name="email" required /></label>
              <label>Phone<input type="tel" name="phone" autoComplete="tel" required /></label>
              <label>Message<textarea name="message" rows="4" required placeholder="Tell us a bit about your needs..." /></label>
              <button type="submit" className="button-primary">Send Message</button>
              <p className="form-note" aria-live="polite">{formNote}</p>
            </form>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="footer-brand">
          <img src={logo} alt="Angels at Home" className="footer-logo" />
          <p>Compassionate home care for Birmingham, AL &amp; surrounding areas.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="#about">Who We Are</a><a href="#services">What We Do</a><a href="#why-us">Why Choose Us</a><a href="#contact">Contact</a><a href="/employee-login">Staff Login</a>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} Angels at Home Care Assistance. All rights reserved.</p>
      </footer>

      {activeService && (
        <div className="detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setActiveService(null)}>
          <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="detail-dialog-header">
              <div><p className="eyebrow">SERVICE DETAILS / {activeService.number}</p><h2 id="detail-title">{activeService.title}</h2></div>
              <button type="button" className="close-detail" onClick={() => setActiveService(null)} aria-label="Close service details">×</button>
            </div>
            <p className="detail-intro">The caregiver’s responsibilities are adjusted to each person’s needs, preferences, assigned shift, and established care plan.</p>
            <div className="detail-sections">
              {activeService.details.map((detail) => (
                <section className="detail-task-group" key={detail.heading}>
                  <h3>{detail.heading}</h3>
                  <ul>{detail.tasks.map((task) => <li key={task}>{task}</li>)}</ul>
                </section>
              ))}
            </div>
            <p className="detail-disclaimer">Medication reminders or assistance are provided only as authorized and described in the care plan. This overview does not replace individual instructions or professional medical advice.</p>
          </section>
        </div>
      )}
    </div>
  )
}