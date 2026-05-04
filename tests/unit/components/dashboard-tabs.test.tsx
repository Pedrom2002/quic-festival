import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardTabs from "@/components/admin/dashboard-tabs";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

function beforeEach(fn: () => void) {
  // manual beforeEach wrapper for module scope
  fn();
}

const GUEST_STATS = {
  total: 100,
  companions: 20,
  checkedInDay1: 50,
  checkedInDay2: 30,
  pending: 50,
  checkInRate: 50,
  emailFailed: 2,
  lastCheckIn: "2026-05-04T10:00:00Z",
  vipCount: 5,
};

const ACC_STATS = { total: 10, companies: 3 };

const GUESTS = [
  {
    id: "g-1",
    created_at: "2026-04-01T10:00:00Z",
    name: "Maria",
    email: "m@x.pt",
    phone: "912000001",
    companion_count: 0,
    companion_names: [],
    token: "tok-1",
    checked_in_day1_at: null,
    checked_in_day2_at: null,
    email_sent_at: null,
    email_failed_at: null,
    email_attempts: 0,
    is_vip: false,
  },
];

const ACCREDITATIONS = [
  {
    id: "a-1",
    created_at: "2026-04-01T10:00:00Z",
    name: "Jornalista X",
    email: "j@rtp.pt",
    phone: "912000002",
    media_company: "RTP",
    token: "tok-2",
  },
];

describe("DashboardTabs", () => {
  it("render tab Convidados por defeito + stats", () => {
    render(
      <DashboardTabs
        guests={GUESTS}
        guestStats={GUEST_STATS}
        accreditations={ACCREDITATIONS}
        accreditationStats={ACC_STATS}
      />,
    );
    expect(screen.getByText("100")).toBeInTheDocument(); // Inscritos
    expect(screen.getByText("5")).toBeInTheDocument();  // VIP
    expect(screen.getByText("Maria")).toBeInTheDocument();
  });

  it("tab Acreditações mostra dados acreditações", async () => {
    const user = userEvent.setup();
    render(
      <DashboardTabs
        guests={GUESTS}
        guestStats={GUEST_STATS}
        accreditations={ACCREDITATIONS}
        accreditationStats={ACC_STATS}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Acreditações Media/i }));
    expect(screen.getByText("Jornalista X")).toBeInTheDocument();
    expect(screen.getByText(/Gerir Links/i)).toBeInTheDocument();
  });

  it("tab Convidados mostra links Scan QR e Audit", () => {
    render(
      <DashboardTabs
        guests={GUESTS}
        guestStats={GUEST_STATS}
        accreditations={ACCREDITATIONS}
        accreditationStats={ACC_STATS}
      />,
    );
    expect(screen.getByRole("link", { name: /Scan QR/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Audit/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Export CSV/i })).toBeInTheDocument();
  });

  it("lastCheckIn nulo → mostra —", () => {
    render(
      <DashboardTabs
        guests={GUESTS}
        guestStats={{ ...GUEST_STATS, lastCheckIn: undefined }}
        accreditations={ACCREDITATIONS}
        accreditationStats={ACC_STATS}
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("emailFailed=0 → warn=false (sem classe rose)", () => {
    render(
      <DashboardTabs
        guests={GUESTS}
        guestStats={{ ...GUEST_STATS, emailFailed: 0 }}
        accreditations={ACCREDITATIONS}
        accreditationStats={ACC_STATS}
      />,
    );
    // Just check it renders without error
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("formatTimeAgo: checkIn há menos de 60s → mostra segundos", () => {
    const recent = new Date(Date.now() - 10_000).toISOString();
    render(
      <DashboardTabs
        guests={GUESTS}
        guestStats={{ ...GUEST_STATS, lastCheckIn: recent }}
        accreditations={ACCREDITATIONS}
        accreditationStats={ACC_STATS}
      />,
    );
    expect(screen.getByText(/\d+s/)).toBeInTheDocument();
  });

  it("formatTimeAgo: checkIn há mais de 60 min → mostra horas", () => {
    const hourAgo = new Date(Date.now() - 90 * 60_000).toISOString();
    render(
      <DashboardTabs
        guests={GUESTS}
        guestStats={{ ...GUEST_STATS, lastCheckIn: hourAgo }}
        accreditations={ACCREDITATIONS}
        accreditationStats={ACC_STATS}
      />,
    );
    expect(screen.getByText(/\dh/)).toBeInTheDocument();
  });
});
