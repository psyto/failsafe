FROM rust:1.95-slim-bookworm AS builder

ARG RDK_REV=3fa40d20e981a08dc03211ee00af6bb062624feb

RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN git clone https://github.com/psyto/rdk.git rdk \
    && cd rdk && git checkout "${RDK_REV}"

COPY . /build/failsafe/sim
WORKDIR /build/failsafe/sim

RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/failsafe/sim/target/release/failsafe-sim /usr/local/bin/failsafe-sim

EXPOSE 7777
CMD ["failsafe-sim"]
