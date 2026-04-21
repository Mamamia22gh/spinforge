pub mod effects;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Upgrade {
    TicketPerSegment,
}
