const express = require("express");
const router = express.Router();

const FAQ_DATA = {
  h1b: [
    {
      q: "What is the H-1B visa?",
      a: "The H-1B is a nonimmigrant visa allowing US employers to temporarily employ foreign workers in specialty occupations requiring a bachelor's degree or higher.",
    },
    {
      q: "How many H-1B visas are issued each year?",
      a: "Congress set the annual H-1B cap at 65,000 regular cap slots plus 20,000 additional slots for US master's degree holders. Cap-exempt employers (universities, nonprofits) are not subject to this limit.",
    },
    {
      q: "What is an RFE in the H-1B process?",
      a: "A Request for Evidence (RFE) is issued by USCIS when the initial petition lacks sufficient documentation. The employer has 87 days to respond. RFE rates have varied significantly by administration.",
    },
    {
      q: "How long can someone stay on H-1B status?",
      a: "Initial H-1B admission is up to 3 years, extendable to 6 years total. Extensions beyond 6 years may be available if an I-140 immigrant petition has been approved.",
    },
    {
      q: "What is the H-1B lottery?",
      a: "When petitions exceed the annual cap, USCIS conducts a random lottery (since 2020: a pre-registration selection) to determine which petitions proceed to adjudication.",
    },
    {
      q: "Which countries send the most H-1B workers?",
      a: "India consistently accounts for 70–75% of H-1B approvals, followed by China (~10%), Canada, South Korea, and the Philippines.",
    },
  ],
  l1: [
    {
      q: "What is the difference between L-1A and L-1B?",
      a: "L-1A is for managers and executives; L-1B is for employees with specialized knowledge. L-1A holders can pursue EB-1C green cards, while L-1B holders typically use EB-2/EB-3.",
    },
    {
      q: "Who qualifies for an L-1 visa?",
      a: "Employees of multinational companies who have worked for a qualifying affiliate abroad for at least 1 continuous year within the past 3 years in a managerial, executive, or specialized knowledge role.",
    },
    {
      q: "How long is the L-1 visa valid?",
      a: "Initial L-1A: 3 years (1 year for new offices). Maximum stay: 7 years (L-1A) or 5 years (L-1B). New office petitions are initially limited to 1 year.",
    },
    {
      q: "Can L-1 visa holders apply for a green card?",
      a: "Yes. L-1A holders often qualify for EB-1C (multinational manager/executive), which does not require PERM labor certification. L-1B holders typically go through PERM + EB-2 or EB-3.",
    },
    {
      q: "Is there a cap on L-1 visas?",
      a: "No. Unlike H-1B, there is no annual numerical cap on L-1 visas. However, visa interview appointments at consulates may create de facto queues.",
    },
  ],
  opt: [
    {
      q: "What is OPT?",
      a: "Optional Practical Training (OPT) allows F-1 students to work in the US in a job related to their field of study. Standard OPT is 12 months; STEM degree holders may apply for a 24-month STEM OPT extension.",
    },
    {
      q: "What is CPT?",
      a: "Curricular Practical Training (CPT) allows F-1 students to work off-campus as part of an established curriculum requirement, such as an internship. CPT must be integral to the degree program.",
    },
    {
      q: "What is STEM OPT?",
      a: "Students who graduate with a degree in Science, Technology, Engineering, or Mathematics (on the DHS STEM Designated Degree Program List) may apply for a 24-month extension of their 12-month OPT.",
    },
    {
      q: "Which schools send the most OPT students?",
      a: "Large research universities dominate OPT counts: University of Southern California, NYU, Columbia, Northeastern, and state flagship universities consistently appear at the top.",
    },
    {
      q: "Can OPT lead to an H-1B?",
      a: "Yes. Many employers use OPT as a bridge to H-1B. Students on STEM OPT can participate in up to 2 H-1B lottery cycles, giving them additional chances at cap selection.",
    },
    {
      q: "What countries do most OPT/CPT students come from?",
      a: "India and China account for the largest share of OPT participants, reflecting their dominance in STEM graduate enrollment at US universities.",
    },
  ],
};

// GET /api/faq?visa=h1b|l1|opt
router.get("/", (req, res) => {
  const visa = (req.query.visa || "").toLowerCase();
  if (visa && FAQ_DATA[visa]) {
    return res.json(FAQ_DATA[visa]);
  }
  res.json(FAQ_DATA);
});

module.exports = router;
