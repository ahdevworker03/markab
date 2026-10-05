# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: staging-reconnect.bench.ts >> staging reconnect benchmark
- Location: e2e/staging-reconnect.bench.ts:637:1

# Error details

```
Error: SRB-muvgqstl-r20 error

expect(received).toBeNull()

Received: "Staging benchmark login failed with 429."
```

# Test source

```ts
  745 |     if (blocked) unblockSync();
  746 |     await context.close();
  747 |     try {
  748 |       postRunCleanup = await deleteBenchmarkCustomers(
  749 |         request,
  750 |         `${BENCHMARK_LABEL_PREFIX}${runId}-`,
  751 |       );
  752 |     } catch (error) {
  753 |       postRunCleanup = { error: firstLine(error) };
  754 |     }
  755 |     const finalNetState = await netState().catch(() => "unknown");
  756 |     const recorded = cycles.filter((cycle) => cycle.kind === "recorded");
  757 |     const successful = recorded.filter((cycle) => cycle.success);
  758 |     const durations = successful.map((cycle) => cycle.durationMs!);
  759 |     const p95 = nearestRank(durations, 0.95);
  760 |     const complete =
  761 |       recorded.length === config.samples &&
  762 |       successful.length === config.samples;
  763 |     let gitRevision = "unknown";
  764 |     let gitDirty: boolean | null = null;
  765 |     try {
  766 |       gitRevision = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
  767 |       gitDirty =
  768 |         execFileSync("git", ["status", "--porcelain"]).toString().trim() !== "";
  769 |     } catch {
  770 |       // Recorded as unknown.
  771 |     }
  772 |     let wrapperSha256 = "unknown";
  773 |     try {
  774 |       wrapperSha256 = createHash("sha256")
  775 |         .update(await readFile(NET_WRAPPER))
  776 |         .digest("hex");
  777 |     } catch {
  778 |       // Recorded as unknown.
  779 |     }
  780 |     const artifact = {
  781 |       benchmark: "step-64-staging-reconnect",
  782 |       mode: config.mode,
  783 |       runId,
  784 |       startedAt,
  785 |       finishedAt: new Date().toISOString(),
  786 |       command:
  787 |         "apps/web/scripts/run-staging-reconnect.sh (systemd scope markab-reconnect-bench)",
  788 |       environment: {
  789 |         webOrigin: STAGING_WEB_ORIGIN,
  790 |         apiOrigin: STAGING_API_ORIGIN,
  791 |         stagingReleaseId: config.releaseId,
  792 |         harnessGitRevision: gitRevision,
  793 |         harnessWorkingTreeDirty: gitDirty,
  794 |         browser: `chromium ${browser.version()}`,
  795 |         viewport: "393x852 @2x",
  796 |         emulation: "none (no CDP network/CPU emulation, no navigator.onLine changes)",
  797 |         interruption:
  798 |           "host nftables table inet markab_bench, cgroup-scoped TCP reset / UDP icmpx admin-prohibited to resolved staging web+API addresses",
  799 |         netWrapperSha256: wrapperSha256,
  800 |       },
  801 |       protocol: {
  802 |         warmups: config.warmups,
  803 |         samples: config.samples,
  804 |         outageHoldMs: config.outageHoldMs,
  805 |         recoveryTimeoutMs: config.recoveryTimeoutMs,
  806 |         queuedOperation: "one CUSTOMER_CREATE via the Add Customer form during the outage",
  807 |         timingBoundary:
  808 |           "from markab-bench-net unblock returning to the in-page IndexedDB poll (50 ms) observing outbox 0, reconciliation_required cleared, provisional removed, exactly one authoritative Customer",
  809 |         percentileMethod: "nearest-rank over successful recorded samples",
  810 |       },
  811 |       preRunCleanup,
  812 |       postRunCleanup,
  813 |       nonStagingRequests,
  814 |       finalNetState,
  815 |       cycles,
  816 |       summary: {
  817 |         recorded: recorded.length,
  818 |         successCount: successful.length,
  819 |         failureCount: recorded.length - successful.length,
  820 |         p50Ms: nearestRank(durations, 0.5),
  821 |         p95Ms: p95,
  822 |         maxMs: durations.length ? Math.max(...durations) : null,
  823 |         gateMs,
  824 |         gate:
  825 |           config.mode !== "full"
  826 |             ? "NOT_EVALUATED (validation mode)"
  827 |             : complete && p95 !== null && p95 <= gateMs
  828 |               ? "PASS"
  829 |               : "FAIL",
  830 |       },
  831 |     };
  832 |     await mkdir(artifactDirectory, { recursive: true });
  833 |     const artifactPath = resolve(
  834 |       artifactDirectory,
  835 |       `${config.mode}-${startedAt.replaceAll(":", "-")}.json`,
  836 |     );
  837 |     await writeFile(artifactPath, JSON.stringify(artifact, null, 2));
  838 |     console.log("STAGING_RECONNECT_ARTIFACT", artifactPath);
  839 |     console.log("STAGING_RECONNECT_SUMMARY", JSON.stringify(artifact.summary));
  840 |     await request.dispose();
  841 |   }
  842 | 
  843 |   expect(nonStagingRequests).toEqual([]);
  844 |   for (const cycle of cycles) {
> 845 |     expect.soft(cycle.error, `${cycle.label} error`).toBeNull();
      |                                                      ^ Error: SRB-muvgqstl-r20 error
  846 |     expect.soft(
  847 |       Object.values(cycle.checks).every(Boolean),
  848 |       `${cycle.label} all checks`,
  849 |     ).toBe(true);
  850 |   }
  851 | });
  852 | 
```